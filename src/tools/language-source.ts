import type { DuolingoClient } from '../client/duolingo.js';
import type {
  DuolingoCurrentCourse,
  DuolingoPathSkill,
  DuolingoSkill,
  DuolingoUserData,
} from '../client/types.js';

function flattenPathSkills(
  skills: DuolingoCurrentCourse['skills'],
): DuolingoPathSkill[] {
  return skills.flatMap((skill) => (Array.isArray(skill) ? skill : [skill]));
}

function courseMatchesLanguage(
  course: DuolingoCurrentCourse,
  languageAbbr: string,
): boolean {
  return (
    course.subject === 'language' &&
    (course.learningLanguage === languageAbbr || course.topic === languageAbbr)
  );
}

function pathSkillsToLegacySkills(
  course: DuolingoCurrentCourse,
): DuolingoSkill[] {
  const statesBySkill = new Map<string, string[]>();
  for (const section of course.pathSectioned) {
    for (const unit of section.units) {
      for (const level of unit.levels) {
        const skillIds =
          level.pathLevelClientData.skillId !== undefined
            ? [level.pathLevelClientData.skillId]
            : (level.pathLevelClientData.skillIds ?? []);
        for (const skillId of skillIds) {
          const states = statesBySkill.get(skillId) ?? [];
          states.push(level.state);
          statesBySkill.set(skillId, states);
        }
      }
    }
  }

  return flattenPathSkills(course.skills).map((skill, index) => {
    const states = statesBySkill.get(skill.id) ?? [];
    const learned =
      skill.finishedLevels > 0 || states.some((state) => state !== 'locked');
    const mastered =
      learned &&
      states.length > 0 &&
      states.every((state) => state === 'legendary');
    const strength = mastered
      ? 1
      : states.includes('passed')
        ? 0.75
        : learned
          ? 0.5
          : 0;
    const progressPercent =
      skill.levels > 0
        ? Math.min(100, (skill.finishedLevels / skill.levels) * 100)
        : learned
          ? 100
          : 0;

    return {
      id: skill.id,
      name: skill.name,
      title: skill.shortName ?? skill.name,
      learned,
      strength,
      progress_percent: progressPercent,
      words: [],
      dependencies_name: [],
      dependency_order: index,
      source: 'learning_path',
    };
  });
}

export async function resolveLanguageSkills(
  client: DuolingoClient,
  userData: DuolingoUserData,
  languageAbbr: string,
): Promise<DuolingoSkill[]> {
  const legacySkills = userData.language_data[languageAbbr]?.skills ?? [];
  if (legacySkills.length > 0) return legacySkills;

  const currentCourse = await client.getCurrentCourse(userData.id);
  if (!courseMatchesLanguage(currentCourse, languageAbbr)) return legacySkills;
  return pathSkillsToLegacySkills(currentCourse);
}

export async function resolveKnownWords(
  client: DuolingoClient,
  userData: DuolingoUserData,
  languageAbbr: string,
  skills: DuolingoSkill[],
): Promise<string[]> {
  const legacyWords = new Set<string>();
  for (const skill of skills) {
    if (!skill.learned) continue;
    for (const word of skill.words) legacyWords.add(word);
  }
  if (legacyWords.size > 0) return [...legacyWords].sort();

  const currentCourse = await client.getCurrentCourse(userData.id);
  if (!courseMatchesLanguage(currentCourse, languageAbbr)) return [];
  const lexemes = await client.getLearnedLexemes(
    languageAbbr,
    currentCourse.fromLanguage,
    userData.id,
  );
  return [...new Set(lexemes.map((lexeme) => lexeme.text))].sort();
}
