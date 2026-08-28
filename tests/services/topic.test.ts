import type { DuolingoClient } from '../../src/client/duolingo.js';
import type { DuolingoCurrentCourse } from '../../src/client/types.js';
import {
  getTopicPracticeMaterial,
  getTopicVocabulary,
  resolveCourseTopic,
} from '../../src/services/topic.js';

const COURSE: DuolingoCurrentCourse = {
  id: 'course-ja-zh',
  subject: 'language',
  topic: 'ja',
  learningLanguage: 'ja',
  fromLanguage: 'zh-CN',
  title: 'Japanese',
  treeId: 'tree-ja-zh',
  skills: [
    {
      id: 'skill-greetings',
      name: 'Greetings',
      shortName: 'Greetings',
      levels: 3,
      finishedLevels: 3,
      strength: 0.8,
    },
    [
      {
        id: 'skill-okinawa',
        name: 'Okinawa',
        shortName: 'Okinawa',
        levels: 6,
        finishedLevels: 2,
        strength: 0.75,
      },
    ],
  ],
  pathSectioned: [
    {
      index: 0,
      completedUnits: 0,
      totalUnits: 1,
      units: [
        {
          unitIndex: 12,
          levels: [
            {
              type: 'skill',
              state: 'passed',
              finishedSessions: 2,
              totalSessions: 2,
              pathLevelClientData: {
                skillId: 'skill-okinawa',
                teachingObjective: 'Talk about Okinawa',
              },
              pathLevelMetadata: { treeId: 'tree-ja-zh' },
            },
            {
              type: 'practice',
              state: 'locked',
              finishedSessions: 0,
              totalSessions: 3,
              pathLevelClientData: { skillIds: ['skill-okinawa'] },
              pathLevelMetadata: { treeId: 'tree-ja-zh' },
            },
          ],
        },
      ],
    },
  ],
};

function makeClient(): DuolingoClient {
  return {
    getUserData: vi.fn().mockResolvedValue({ id: 12345, language_data: {} }),
    getCurrentCourse: vi.fn().mockResolvedValue(COURSE),
    getSkillLearnedLexemes: vi.fn().mockResolvedValue([
      { text: '沖縄', translations: ['Okinawa'] },
      { text: '海', translations: ['sea'] },
    ]),
    getSkillPracticeSession: vi.fn().mockResolvedValue({
      challenges: [
        {
          type: 'translate',
          prompt: '沖縄の海はきれいです。',
          correctSolutions: ["Okinawa's sea is beautiful."],
        },
      ],
    }),
  } as unknown as DuolingoClient;
}

describe('topic learning services', () => {
  it('resolves a one-based topic and its path progress', () => {
    expect(resolveCourseTopic(COURSE, 2)).toMatchObject({
      position: 2,
      total_topics: 2,
      id: 'skill-okinawa',
      title: 'Okinawa',
      finished_levels: 2,
      total_levels: 6,
      progress_percent: 33.33333333333333,
      path: {
        section_index: 0,
        unit_index: 12,
        level_index: 0,
        finished_sessions: 2,
        total_sessions: 2,
        tree_id: 'tree-ja-zh',
      },
    });
  });

  it('rejects a topic position outside the active course', () => {
    expect(() => resolveCourseTopic(COURSE, 3)).toThrow(
      'Topic 3 does not exist; this course has 2 topics.',
    );
  });

  it('returns lexemes scoped to the selected topic', async () => {
    const client = makeClient();
    const result = await getTopicVocabulary(client, {
      language: 'ja',
      topicPosition: 2,
    });

    expect(result.topic.id).toBe('skill-okinawa');
    expect(result.words.map((word) => word.text)).toEqual(['沖縄', '海']);
    const mocks = client as unknown as {
      getSkillLearnedLexemes: ReturnType<typeof vi.fn>;
    };
    expect(mocks.getSkillLearnedLexemes).toHaveBeenCalledWith(
      'ja',
      'zh-CN',
      {
        skillId: 'skill-okinawa',
        finishedLevels: 2,
        finishedSessions: 2,
      },
      12345,
    );
  });

  it('uses the same legacy topic ordering exposed by language skills', async () => {
    const client = makeClient();
    const mocks = client as unknown as {
      getUserData: ReturnType<typeof vi.fn>;
      getSkillLearnedLexemes: ReturnType<typeof vi.fn>;
    };
    mocks.getUserData.mockResolvedValue({
      id: 12345,
      language_data: {
        ja: {
          skills: [
            {
              id: 'skill-okinawa',
              name: 'Okinawa',
              title: 'Okinawa',
              learned: true,
              strength: 0.75,
              progress_percent: 100,
              words: [],
              dependencies_name: [],
            },
            {
              id: 'skill-greetings',
              name: 'Greetings',
              title: 'Greetings',
              learned: true,
              strength: 1,
              progress_percent: 100,
              words: [],
              dependencies_name: [],
            },
          ],
        },
      },
    } as never);

    const result = await getTopicVocabulary(client, {
      language: 'ja',
      topicPosition: 1,
    });

    expect(result.topic.id).toBe('skill-okinawa');
    expect(mocks.getSkillLearnedLexemes).toHaveBeenCalledWith(
      'ja',
      'zh-CN',
      expect.objectContaining({ skillId: 'skill-okinawa' }),
      12345,
    );
  });

  it('samples only selected-topic sessions and extracts sentences', async () => {
    const client = makeClient();
    const result = await getTopicPracticeMaterial(client, {
      language: 'ja',
      topicPosition: 2,
      sessions: 2,
      sentenceLimit: 10,
    });

    expect(result.sessions_requested).toBe(2);
    expect(result.sessions_returned).toBe(2);
    expect(result.sentences).toHaveLength(1);
    expect(result.sentences[0]).toMatchObject({
      prompt: '沖縄の海はきれいです。',
      answers: ["Okinawa's sea is beautiful."],
    });
    const mocks = client as unknown as {
      getSkillPracticeSession: ReturnType<typeof vi.fn>;
    };
    expect(mocks.getSkillPracticeSession).toHaveBeenCalledTimes(2);
    expect(mocks.getSkillPracticeSession).toHaveBeenCalledWith('ja', 'zh-CN', {
      skillId: 'skill-okinawa',
      levelIndex: 0,
      levelSessionIndex: 2,
      treeId: 'tree-ja-zh',
    });
  });
});
