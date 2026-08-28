import type { DuolingoClient } from '../client/duolingo.js';
import { DuolingoClientError } from '../client/errors.js';
import type {
  DuolingoCurrentCourse,
  DuolingoLearnedLexeme,
  DuolingoPathLevel,
  DuolingoPathSkill,
} from '../client/types.js';
import { samplePracticeSentences, type PracticeSentence } from './practice.js';

function courseMatchesLanguage(
  course: DuolingoCurrentCourse,
  language: string,
): boolean {
  return (
    course.subject === 'language' &&
    (course.learningLanguage === language || course.topic === language)
  );
}

export interface TopicPathLocation {
  section_index: number;
  unit_index: number;
  level_index: number;
  state: string;
  finished_sessions: number;
  total_sessions: number;
  tree_id?: string;
}

export interface ResolvedCourseTopic {
  position: number;
  total_topics: number;
  id: string;
  name: string;
  title: string;
  finished_levels: number;
  total_levels: number;
  progress_percent: number;
  strength: number | null;
  path: TopicPathLocation | null;
}

export interface TopicRequest {
  language: string;
  topicPosition: number;
  username?: string;
}

export interface TopicVocabularyResult {
  language: string;
  from_language: string;
  course_id: string;
  topic: ResolvedCourseTopic;
  words: DuolingoLearnedLexeme[];
}

export interface TopicPracticeRequest extends TopicRequest {
  sessions: number;
  sentenceLimit: number;
}

export interface TopicPracticeResult {
  language: string;
  from_language: string;
  course_id: string;
  topic: ResolvedCourseTopic;
  sessions_requested: number;
  sessions_returned: number;
  sentences: PracticeSentence[];
}

function flattenPathSkills(
  skills: DuolingoCurrentCourse['skills'],
): DuolingoPathSkill[] {
  return skills.flatMap((skill) => (Array.isArray(skill) ? skill : [skill]));
}

function levelContainsSkill(
  level: DuolingoPathLevel,
  skillId: string,
): boolean {
  for (const data of [level.pathLevelMetadata, level.pathLevelClientData]) {
    if (
      data?.skillId === skillId ||
      data?.skillIds?.includes(skillId) === true
    ) {
      return true;
    }
  }
  return false;
}

function levelDirectlyTeachesSkill(
  level: DuolingoPathLevel,
  skillId: string,
): boolean {
  return (
    level.type === 'skill' &&
    (level.pathLevelMetadata?.skillId === skillId ||
      level.pathLevelClientData.skillId === skillId)
  );
}

function readLevelIndex(level: DuolingoPathLevel, fallback: number): number {
  for (const value of [
    level.pathLevelClientData.crownLevelIndex,
    level.pathLevelMetadata?.crownLevelIndex,
  ]) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      return value;
    }
  }
  return fallback;
}

function readTreeId(
  level: DuolingoPathLevel,
  course: DuolingoCurrentCourse,
): string | undefined {
  for (const value of [
    level.pathLevelMetadata?.treeId,
    level.pathLevelClientData.treeId,
    course.treeId,
  ]) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function findPathLocation(
  course: DuolingoCurrentCourse,
  skillId: string,
): TopicPathLocation | null {
  const directLocations: TopicPathLocation[] = [];
  const fallbackLocations: TopicPathLocation[] = [];
  for (const section of course.pathSectioned) {
    for (const unit of section.units) {
      for (const [levelIndex, level] of unit.levels.entries()) {
        if (!levelContainsSkill(level, skillId)) continue;
        const treeId = readTreeId(level, course);
        const location: TopicPathLocation = {
          section_index: section.index,
          unit_index: unit.unitIndex,
          level_index: readLevelIndex(level, levelIndex),
          state: level.state,
          finished_sessions: level.finishedSessions,
          total_sessions: level.totalSessions,
          ...(treeId === undefined ? {} : { tree_id: treeId }),
        };
        fallbackLocations.push(location);
        if (levelDirectlyTeachesSkill(level, skillId)) {
          directLocations.push(location);
        }
      }
    }
  }

  const locations =
    directLocations.length > 0 ? directLocations : fallbackLocations;
  return (
    locations.find(
      (location) =>
        location.finished_sessions < location.total_sessions &&
        !['completed', 'legendary', 'locked', 'passed'].includes(
          location.state,
        ),
    ) ??
    locations.at(-1) ??
    null
  );
}

export function resolveCourseTopic(
  course: DuolingoCurrentCourse,
  topicPosition: number,
): ResolvedCourseTopic {
  if (!Number.isInteger(topicPosition) || topicPosition < 1) {
    throw new DuolingoClientError('Topic position must be a positive integer.');
  }
  const skills = flattenPathSkills(course.skills);
  const skill = skills[topicPosition - 1];
  if (skill === undefined) {
    throw new DuolingoClientError(
      `Topic ${topicPosition} does not exist; this course has ${skills.length} topics.`,
    );
  }
  return {
    position: topicPosition,
    total_topics: skills.length,
    id: skill.id,
    name: skill.name,
    title: skill.shortName ?? skill.name,
    finished_levels: skill.finishedLevels,
    total_levels: skill.levels,
    progress_percent:
      skill.levels === 0
        ? skill.finishedLevels > 0
          ? 100
          : 0
        : Math.min(100, (skill.finishedLevels / skill.levels) * 100),
    strength: skill.strength,
    path: findPathLocation(course, skill.id),
  };
}

async function resolveTopicRequest(
  client: DuolingoClient,
  request: TopicRequest,
): Promise<{
  userId: number;
  course: DuolingoCurrentCourse;
  topic: ResolvedCourseTopic;
}> {
  const user = await client.getUserData(request.username);
  const course = await client.getCurrentCourse(user.id);
  if (!courseMatchesLanguage(course, request.language)) {
    throw new DuolingoClientError(
      `Language '${request.language}' is not the active learning-path course.`,
    );
  }
  return {
    userId: user.id,
    course,
    topic: resolveCourseTopic(course, request.topicPosition),
  };
}

export async function getTopicVocabulary(
  client: DuolingoClient,
  request: TopicRequest,
): Promise<TopicVocabularyResult> {
  const { userId, course, topic } = await resolveTopicRequest(client, request);
  const words = await client.getSkillLearnedLexemes(
    request.language,
    course.fromLanguage,
    {
      skillId: topic.id,
      finishedLevels: topic.finished_levels,
      finishedSessions: topic.path?.finished_sessions ?? 0,
    },
    userId,
  );
  return {
    language: request.language,
    from_language: course.fromLanguage,
    course_id: course.id,
    topic,
    words,
  };
}

export async function getTopicPracticeMaterial(
  client: DuolingoClient,
  request: TopicPracticeRequest,
): Promise<TopicPracticeResult> {
  const { course, topic } = await resolveTopicRequest(client, request);
  const path = topic.path;
  const practiceOptions = {
    skillId: topic.id,
    levelIndex: path?.level_index ?? Math.max(0, topic.finished_levels - 1),
    levelSessionIndex: path?.finished_sessions ?? 0,
    ...(path?.tree_id === undefined ? {} : { treeId: path.tree_id }),
  };
  const sample = await samplePracticeSentences(
    () =>
      client.getSkillPracticeSession(
        request.language,
        course.fromLanguage,
        practiceOptions,
      ),
    request.sessions,
    request.sentenceLimit,
  );
  return {
    language: request.language,
    from_language: course.fromLanguage,
    course_id: course.id,
    topic,
    sessions_requested: request.sessions,
    sessions_returned: sample.sessionsReturned,
    sentences: sample.sentences,
  };
}
