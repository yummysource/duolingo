import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  DuolingoClient,
  getClient,
  resetClient,
} from '../../src/client/duolingo.js';
import {
  DuolingoAuthError,
  DuolingoCaptchaError,
  DuolingoNotFoundError,
  DuolingoRateLimitError,
} from '../../src/client/errors.js';
import type { DuolingoUserData } from '../../src/client/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER_DATA: DuolingoUserData = {
  username: 'testuser',
  bio: 'Test bio',
  id: 12345,
  cohort: 1,
  learning_language_string: 'French',
  creation_date: '2020-01-01T00:00:00',
  admin: false,
  location: 'Berlin',
  fullname: 'Test User',
  avatar: 'https://example.com/avatar.jpg',
  ui_language: 'en',
  daily_goal: 50,
  site_streak: 42,
  streak_extended_today: true,
  notify_comment: true,
  deactivated: false,
  tracking_properties: { num_followers: 10, num_following: 5 },
  calendar: [{ datetime: 1699920000000, improvement: 10 }], // 2023-11-14
  languages: [
    {
      language: 'fr',
      language_string: 'French',
      learning: true,
      current_learning: true,
      level: 5,
      points: 1500,
      streak: 42,
    },
  ],
  language_data: {
    fr: {
      streak: 42,
      language_string: 'French',
      level_progress: 200,
      num_skills_learned: 15,
      level_percent: 40,
      level_points: 500,
      next_level: 6,
      level_left: 300,
      language: 'fr',
      points: 1500,
      fluency_score: 0.35,
      level: 5,
      calendar: [{ datetime: 1699920000000, improvement: 10 }], // 2023-11-14
      skills: [
        {
          id: 'skill-1',
          name: 'Basics 1',
          title: 'Basics 1',
          learned: true,
          strength: 1.0,
          progress_percent: 100,
          words: ['bonjour', 'merci'],
          dependencies_name: [],
        },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Helper: create a client with a mocked http instance
// ---------------------------------------------------------------------------

function makeClientWithMockHttp(
  responses: Map<string, { status: number; data: unknown }>,
): DuolingoClient {
  const client = new DuolingoClient('testuser', 'test-jwt');

  // Replace the internal http instance with a mock
  const mockHttp = {
    get: vi.fn(async (url: string) => {
      const key = [...responses.keys()].find((k) => url.includes(k));
      if (!key)
        throw Object.assign(new Error('Network error'), {
          isAxiosError: false,
        });
      const resp = responses.get(key)!;
      if (resp.status >= 400) {
        const err = Object.assign(new Error(`HTTP ${resp.status}`), {
          isAxiosError: true,
          response: { status: resp.status, data: resp.data, headers: {} },
        });
        throw err;
      }
      return { data: resp.data, status: resp.status };
    }),
    post: vi.fn(async (url: string, _data: unknown) => {
      const key = [...responses.keys()].find((k) => url.includes(k));
      if (!key)
        throw Object.assign(new Error('Network error'), {
          isAxiosError: false,
        });
      const resp = responses.get(key)!;
      if (resp.status >= 400) {
        const err = Object.assign(new Error(`HTTP ${resp.status}`), {
          isAxiosError: true,
          response: { status: resp.status, data: resp.data, headers: {} },
        });
        throw err;
      }
      return { data: resp.data, status: resp.status };
    }),
  };

  // Inject mock http
  (client as unknown as { http: typeof mockHttp }).http = mockHttp;
  return client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DuolingoClient', () => {
  afterEach(() => {
    resetClient();
  });

  // -------------------------------------------------------------------------
  // getUserData
  // -------------------------------------------------------------------------
  describe('getUserData', () => {
    it('fetches user data for the authenticated user', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 200, data: MOCK_USER_DATA }]]),
      );
      const data = await client.getUserData();
      expect(data.username).toBe('testuser');
      expect(data.site_streak).toBe(42);
    });

    it('fetches user data for a different username', async () => {
      const otherUser = { ...MOCK_USER_DATA, username: 'otheruser' };
      const client = makeClientWithMockHttp(
        new Map([['/users/otheruser', { status: 200, data: otherUser }]]),
      );
      const data = await client.getUserData('otheruser');
      expect(data.username).toBe('otheruser');
    });

    it('caches user data on repeated calls', async () => {
      const responses = new Map([
        ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
      ]);
      const client = makeClientWithMockHttp(responses);
      const mockGet = (
        client as unknown as { http: { get: ReturnType<typeof vi.fn> } }
      ).http.get;

      await client.getUserData();
      await client.getUserData();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('invalidates cache and re-fetches after invalidateCache()', async () => {
      const responses = new Map([
        ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
      ]);
      const client = makeClientWithMockHttp(responses);
      const mockGet = (
        client as unknown as { http: { get: ReturnType<typeof vi.fn> } }
      ).http.get;

      await client.getUserData();
      client.invalidateCache('testuser');
      await client.getUserData();

      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('throws DuolingoNotFoundError on 404', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/nobody', { status: 404, data: {} }]]),
      );
      await expect(client.getUserData('nobody')).rejects.toThrow(
        DuolingoNotFoundError,
      );
    });

    it('throws DuolingoAuthError on 401', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 401, data: {} }]]),
      );
      await expect(client.getUserData()).rejects.toThrow(DuolingoAuthError);
    });

    it('throws DuolingoAuthError on 403 without blockScript', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 403, data: {} }]]),
      );
      await expect(client.getUserData()).rejects.toThrow(DuolingoAuthError);
    });

    it('throws DuolingoCaptchaError on 403 with blockScript', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 403, data: { blockScript: 'script' } }],
        ]),
      );
      await expect(client.getUserData()).rejects.toThrow(DuolingoCaptchaError);
    });

    it('throws a distinct rate-limit error on 429', async () => {
      const client = makeClientWithMockHttp(
        new Map([['/users/testuser', { status: 429, data: {} }]]),
      );
      await expect(client.getUserData()).rejects.toThrow(
        DuolingoRateLimitError,
      );
    });
  });

  describe('learning path data', () => {
    const currentCourse = {
      id: 'course-ja-zh',
      subject: 'language',
      topic: 'ja',
      learningLanguage: 'ja',
      fromLanguage: 'zh-CN',
      title: 'Japanese',
      skills: [
        {
          id: 'skill-1',
          name: 'Basics',
          shortName: 'Basics',
          levels: 6,
          finishedLevels: 2,
          strength: null,
        },
      ],
      pathSectioned: [
        {
          index: 0,
          completedUnits: 1,
          totalUnits: 2,
          units: [
            {
              unitIndex: 0,
              levels: [
                {
                  type: 'skill',
                  state: 'legendary',
                  finishedSessions: 4,
                  totalSessions: 4,
                  pathLevelClientData: {},
                  pathLevelMetadata: { skillId: 'skill-1' },
                },
              ],
            },
            {
              unitIndex: 1,
              levels: [
                {
                  type: 'skill',
                  state: 'unit_test',
                  finishedSessions: 2,
                  totalSessions: 4,
                  pathLevelClientData: { skillId: 'skill-active' },
                },
              ],
            },
          ],
        },
      ],
    };

    it('fetches current learning-path course data', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['fields=currentCourse', { status: 200, data: { currentCourse } }],
        ]),
      );

      await expect(client.getCurrentCourse()).resolves.toMatchObject({
        learningLanguage: 'ja',
        fromLanguage: 'zh-CN',
      });
    });

    it('paginates learned lexemes for the current course', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['fields=currentCourse', { status: 200, data: { currentCourse } }],
          [
            'startIndex=0',
            {
              status: 200,
              data: {
                learnedLexemes: [
                  {
                    text: '日本',
                    translations: ['Japan'],
                    audioURL: 'https://example.com/nihon.mp3',
                    isNew: false,
                  },
                ],
                pagination: { totalLexemes: 2, nextStartIndex: 1 },
              },
            },
          ],
          [
            'startIndex=1',
            {
              status: 200,
              data: {
                learnedLexemes: [
                  {
                    text: '学生',
                    translations: ['student'],
                    audioURL: 'https://example.com/gakusei.mp3',
                    isNew: false,
                  },
                ],
                pagination: { totalLexemes: 2, nextStartIndex: 0 },
              },
            },
          ],
        ]),
      );

      const words = await client.getLearnedLexemes('ja', 'zh-CN');

      expect(words.map((word) => word.text)).toEqual(['日本', '学生']);
      const mockPost = (
        client as unknown as { http: { post: ReturnType<typeof vi.fn> } }
      ).http.post;
      expect(mockPost).toHaveBeenCalledTimes(2);
    });

    it('sorts recent lexemes by learned date and includes active path skills', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['fields=currentCourse', { status: 200, data: { currentCourse } }],
          [
            'sortBy=LEARNED_DATE',
            {
              status: 200,
              data: {
                learnedLexemes: [
                  { text: 'パイナップル', translations: ['pineapple'] },
                  { text: 'ストロー', translations: ['straw'] },
                ],
                pagination: { totalLexemes: 961, nextStartIndex: null },
              },
            },
          ],
        ]),
      );

      const words = await client.getLearnedLexemes('ja', 'zh-CN', undefined, {
        sortBy: 'LEARNED_DATE',
        limit: 2,
      });

      expect(words.map((word) => word.text)).toEqual([
        'パイナップル',
        'ストロー',
      ]);
      const mockPost = (
        client as unknown as { http: { post: ReturnType<typeof vi.fn> } }
      ).http.post;
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining('limit=2&sortBy=LEARNED_DATE&startIndex=0'),
        {
          lastTimeLearnedAt: null,
          progressedSkills: [
            {
              finishedLevels: 1,
              finishedSessions: 4,
              skillId: { id: 'skill-1' },
            },
            {
              finishedLevels: 0,
              finishedSessions: 2,
              skillId: { id: 'skill-active' },
            },
          ],
        },
      );
    });

    it('queries learned lexemes for exactly one path topic', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          [
            'learned-lexemes',
            {
              status: 200,
              data: {
                learnedLexemes: [{ text: '沖縄', translations: ['Okinawa'] }],
                pagination: { totalLexemes: 1, nextStartIndex: null },
              },
            },
          ],
        ]),
      );

      const words = await client.getSkillLearnedLexemes(
        'ja',
        'zh-CN',
        {
          skillId: 'skill-okinawa',
          finishedLevels: 1,
          finishedSessions: 2,
        },
        12345,
      );

      expect(words).toEqual([{ text: '沖縄', translations: ['Okinawa'] }]);
      const mockPost = (
        client as unknown as { http: { post: ReturnType<typeof vi.fn> } }
      ).http.post;
      expect(mockPost).toHaveBeenCalledWith(
        expect.stringContaining(
          '/users/12345/courses/ja/zh-CN/learned-lexemes',
        ),
        {
          lastTimeLearnedAt: null,
          progressedSkills: [
            {
              finishedLevels: 1,
              finishedSessions: 2,
              skillId: { id: 'skill-okinawa' },
            },
          ],
        },
      );
    });

    it('creates a topic-scoped practice session without completing it', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          [
            '/2023-05-23/sessions',
            {
              status: 200,
              data: {
                id: 'session-1',
                challenges: [{ type: 'translate', prompt: '沖縄へ行きます。' }],
              },
            },
          ],
        ]),
      );

      const session = await client.getSkillPracticeSession('ja', 'zh-CN', {
        skillId: 'skill-okinawa',
        levelIndex: 3,
        levelSessionIndex: 2,
        treeId: 'tree-ja-zh',
      });

      expect(session?.challenges).toHaveLength(1);
      const mockHttp = (
        client as unknown as {
          http: {
            post: ReturnType<typeof vi.fn>;
            put?: ReturnType<typeof vi.fn>;
          };
        }
      ).http;
      expect(mockHttp.post).toHaveBeenCalledWith(
        'https://www.duolingo.com/2023-05-23/sessions',
        expect.objectContaining({
          fromLanguage: 'zh-CN',
          learningLanguage: 'ja',
          skillIds: ['skill-okinawa'],
          levelIndex: 3,
          levelSessionIndex: 2,
          treeId: 'tree-ja-zh',
          type: 'LEXEME_SKILL_LEVEL_PRACTICE',
        }),
      );
      expect(mockHttp.put).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getUserDataById
  // -------------------------------------------------------------------------
  describe('getUserDataById', () => {
    it('fetches daily progress data', async () => {
      const mockProgress = {
        xpGoal: 50,
        xpGains: [{ skillId: 'skill-1', xp: 10, time: 1700000000 }],
        streakData: { updatedTimestamp: 1700000000 },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/2023-05-23/users/12345', { status: 200, data: mockProgress }],
        ]),
      );
      const data = await client.getUserDataById(12345, [
        'xpGoal',
        'xpGains',
        'streakData',
      ]);
      expect(data.xpGoal).toBe(50);
      expect(data.xpGains).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getFollowing / getFollowers
  // -------------------------------------------------------------------------
  describe('getFollowing', () => {
    it('fetches the list of users the authenticated user follows', async () => {
      const mockFollowing = {
        following: {
          users: [
            {
              userId: 99001,
              username: 'friend1',
              displayName: 'Friend One',
              picture: '//example.com/avatar.jpg',
              totalXp: 2000,
              isFollowing: true,
              isFollowedBy: false,
              hasSubscription: false,
              userScore: { courseId: 'DUOLINGO_FR_EN', score: 150 },
            },
          ],
          totalUsers: 1,
          cursor: null,
        },
      };
      const client = makeClientWithMockHttp(
        new Map([
          // getFollowing now calls getAuthenticatedUserId() → getUserData()
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          [
            '/friends/users/12345/following',
            { status: 200, data: mockFollowing },
          ],
        ]),
      );
      const users = await client.getFollowing(12345);
      expect(users).toHaveLength(1);
      expect(users[0]!.username).toBe('friend1');
      expect(users[0]!.totalXp).toBe(2000);
    });
  });

  // -------------------------------------------------------------------------
  // getLeaderboard
  // -------------------------------------------------------------------------
  describe('getLeaderboard', () => {
    it('fetches leaderboard data', async () => {
      const mockLeaderboard = {
        ranking: { '99001': '2000', '12345': '1500' },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['leaderboard_activity', { status: 200, data: mockLeaderboard }],
        ]),
      );
      const data = await client.getLeaderboard('week', '1234567890');
      expect(data.ranking).toEqual({ '99001': '2000', '12345': '1500' });
    });
  });

  // -------------------------------------------------------------------------
  // getLanguageVoices / extractVoiceFromTtsUrl
  // -------------------------------------------------------------------------
  describe('getLanguageVoices', () => {
    it('extracts voice names from legacy challenge tts URLs', async () => {
      // Legacy TTS URL format: https://<cdn>/<voiceName>/<hash>
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/abc123',
          },
          {
            prompt: 'gracias',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/juniores/def456',
          },
          {
            prompt: 'adios',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/ghi789', // duplicate voice
          },
        ],
        ttsAnnotations: {},
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toContain('beaes');
      expect(voices).toContain('juniores');
      expect(voices).toHaveLength(2); // deduped
    });

    it('extracts voice names from modern tts URLs', async () => {
      // Modern TTS URL format: https://<cdn>/tts/<lang>/<voice>/token/<word>
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/beaes/token/hola',
          },
          {
            prompt: 'gracias',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/juniores/token/gracias',
          },
          {
            // No-voice URL (tts/<lang>/token/<word>) should not produce a voice
            prompt: 'adios',
            tts: 'https://d7mj4aqfscim2.cloudfront.net/tts/es/token/adios',
          },
        ],
        ttsAnnotations: {},
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toContain('beaes');
      expect(voices).toContain('juniores');
      expect(voices).not.toContain('token'); // no-voice URL should not produce 'token'
      expect(voices).not.toContain('tts');
    });

    it('extracts voice names from ttsAnnotations keys', async () => {
      const mockSession = {
        challenges: [],
        ttsAnnotations: {
          'https://d1vq87e9lcf771.cloudfront.net/vikrames/aaa111': {},
          'https://d1vq87e9lcf771.cloudfront.net/oscares/bbb222': {},
        },
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toContain('vikrames');
      expect(voices).toContain('oscares');
    });

    it('returns empty array when session is unavailable', async () => {
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 500, data: {} }],
        ]),
      );
      const voices = await client.getLanguageVoices('es');
      expect(voices).toEqual([]);
    });

    it('caches voice results on repeated calls', async () => {
      const mockSession = {
        challenges: [
          {
            prompt: 'hola',
            tts: 'https://d1vq87e9lcf771.cloudfront.net/beaes/abc123',
          },
        ],
        ttsAnnotations: {},
      };
      const client = makeClientWithMockHttp(
        new Map([
          ['/users/testuser', { status: 200, data: MOCK_USER_DATA }],
          ['/2017-06-30/sessions', { status: 200, data: mockSession }],
        ]),
      );
      const mockPost = (
        client as unknown as { http: { post: ReturnType<typeof vi.fn> } }
      ).http.post;

      await client.getLanguageVoices('es');
      await client.getLanguageVoices('es'); // second call should use cache

      // Only one POST to sessions (first call), second uses cache
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// getClient singleton
// ---------------------------------------------------------------------------
describe('getClient', () => {
  afterEach(() => {
    resetClient();
    delete process.env.DUOLINGO_USERNAME;
    delete process.env.DUOLINGO_JWT;
  });

  it('throws DuolingoAuthError when DUOLINGO_USERNAME is missing', () => {
    delete process.env.DUOLINGO_USERNAME;
    process.env.DUOLINGO_JWT = 'some-jwt';
    expect(() => getClient()).toThrow(DuolingoAuthError);
  });

  it('throws DuolingoAuthError when DUOLINGO_JWT is missing', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    delete process.env.DUOLINGO_JWT;
    expect(() => getClient()).toThrow(DuolingoAuthError);
  });

  it('creates a client when both env vars are set', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    process.env.DUOLINGO_JWT = 'some-jwt';
    const client = getClient();
    expect(client).toBeInstanceOf(DuolingoClient);
  });

  it('returns the same instance on repeated calls', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    process.env.DUOLINGO_JWT = 'some-jwt';
    const c1 = getClient();
    const c2 = getClient();
    expect(c1).toBe(c2);
  });

  it('creates a new instance after resetClient()', () => {
    process.env.DUOLINGO_USERNAME = 'testuser';
    process.env.DUOLINGO_JWT = 'some-jwt';
    const c1 = getClient();
    resetClient();
    const c2 = getClient();
    expect(c1).not.toBe(c2);
  });
});
