import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import type {
  DuolingoDailyProgress,
  DuolingoSessionResponse,
  DuolingoUserData,
  DuolingoUserDataV2,
} from '../../src/client/types.js';
import { registerReviewTools } from '../../src/tools/review.js';
import { callTool } from '../helpers.js';

const MOCK_USER_DATA: DuolingoUserData = {
  username: 'testuser',
  bio: '',
  id: 12345,
  cohort: 1,
  learning_language_string: 'French',
  creation_date: '2020-01-01T00:00:00',
  admin: false,
  location: null,
  fullname: '',
  avatar: '',
  ui_language: 'en',
  daily_goal: 50,
  site_streak: 10,
  streak_extended_today: false,
  notify_comment: false,
  deactivated: false,
  calendar: [],
  languages: [
    {
      language: 'fr',
      language_string: 'French',
      learning: true,
      current_learning: true,
      level: 5,
      points: 1500,
      streak: 10,
    },
  ],
  language_data: {
    fr: {
      streak: 10,
      language_string: 'French',
      level_progress: 200,
      num_skills_learned: 3,
      level_percent: 40,
      level_points: 500,
      next_level: 6,
      level_left: 300,
      language: 'fr',
      points: 1500,
      fluency_score: 0.35,
      level: 5,
      calendar: [],
      skills: [
        {
          id: 'skill-basics',
          name: 'Basics',
          title: 'Basics',
          learned: true,
          strength: 0.9,
          progress_percent: 100,
          words: ['bonjour', 'merci'],
          dependencies_name: [],
        },
        {
          id: 'skill-travel',
          name: 'Travel',
          title: 'Travel',
          learned: true,
          strength: 0.35,
          progress_percent: 100,
          words: ['gare', 'billet', 'gare'],
          dependencies_name: ['Basics'],
        },
        {
          id: 'skill-food',
          name: 'Food',
          title: 'Food',
          learned: true,
          strength: 0.65,
          progress_percent: 100,
          words: ['pain', 'eau'],
          dependencies_name: ['Basics'],
        },
        {
          id: 'skill-colors',
          name: 'Colors',
          title: 'Colors',
          learned: false,
          strength: 0,
          progress_percent: 0,
          words: ['rouge'],
          dependencies_name: ['Basics'],
        },
      ],
    },
  },
};

const MOCK_USER_DATA_V2: DuolingoUserDataV2 = {
  id: 12345,
  username: 'testuser',
  name: 'Test User',
  picture: '',
  totalXp: 1500,
  streak: 10,
  streakData: { currentStreak: null, previousStreak: null },
  courses: [
    {
      id: 'DUOLINGO_FR_DE',
      subject: 'language',
      topic: 'fr',
      xp: 1500,
      fromLanguage: 'de',
      learningLanguage: 'fr',
      title: 'French',
    },
  ],
  hasPlus: false,
  subscriberLevel: 'FREE',
  fromLanguage: 'de',
  learningLanguage: 'fr',
};

const FIRST_SESSION: DuolingoSessionResponse = {
  challenges: [
    {
      type: 'translate',
      prompt: 'Où est la gare ?',
      correctSolutions: ['Where is the station?'],
      tokens: [
        { value: 'Où', tts: 'https://example.com/ou.mp3' },
        { value: 'est' },
        [{ value: 'la' }, { value: 'gare' }],
      ],
      tts: 'https://example.com/sentence.mp3',
    },
    {
      type: 'listen',
      correctTokens: [
        { value: 'Je', tts: 'https://example.com/je.mp3' },
        { value: 'voudrais' },
        { value: 'un' },
        { value: 'billet' },
        { value: 'billet' },
      ],
      metadata: {
        non_character_tts: {
          tokens: {
            billet: 'https://example.com/billet.mp3',
            duplicate: 'https://example.com/je.mp3',
          },
        },
      },
    },
  ],
};

const SECOND_SESSION: DuolingoSessionResponse = {
  challenges: [
    {
      type: 'translate',
      prompt: '  où  est la gare ? ',
      correctSolutions: ['Where is the station?'],
      tokens: [{ value: 'duplicate' }],
    },
    {
      type: 'translate',
      prompt: 'Je cherche le quai.',
      correctSolutions: ['I am looking for the platform.'],
      displayTokens: [{ text: 'Je' }, { text: 'cherche' }],
    },
  ],
};

describe('Review Tools', () => {
  let server: McpServer;
  let mockClient: Partial<DuolingoClient>;

  beforeEach(() => {
    const now = Math.floor(Date.now() / 1000);
    const dailyProgress: DuolingoDailyProgress = {
      xpGoal: 50,
      xpGains: [
        {
          skillId: 'skill-travel',
          xp: 15,
          time: now - 3600,
          eventType: 'lesson',
        },
        {
          skillId: 'skill-travel',
          xp: 10,
          time: now - 7200,
          eventType: 'practice',
        },
        {
          skillId: 'skill-basics',
          xp: 5,
          time: now - 86400,
          eventType: 'lesson',
        },
        {
          skillId: 'skill-from-another-course',
          xp: 99,
          time: now - 1800,
          eventType: 'lesson',
        },
        {
          skillId: 'skill-food',
          xp: 20,
          time: now - 10 * 86400,
          eventType: 'lesson',
        },
      ],
      streakData: { updatedTimestamp: now },
    };

    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      getUserData: vi.fn().mockResolvedValue(MOCK_USER_DATA),
      getUserDataV2: vi.fn().mockResolvedValue(MOCK_USER_DATA_V2),
      getUserDataById: vi.fn().mockResolvedValue(dailyProgress),
      getGlobalPracticeSession: vi
        .fn()
        .mockResolvedValueOnce(FIRST_SESSION)
        .mockResolvedValueOnce(SECOND_SESSION)
        .mockResolvedValue(FIRST_SESSION),
    };
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
      mockClient as DuolingoClient,
    );
    registerReviewTools(server);
  });

  describe('duolingo_get_practice_sentences', () => {
    it('samples sessions, extracts sentence fields, and deduplicates text', async () => {
      const result = await callTool(server, 'duolingo_get_practice_sentences', {
        language_abbr: 'fr',
        from_language: 'en',
        sessions: 2,
        sentence_limit: 10,
        response_format: 'json',
      });
      const parsed = JSON.parse(result);

      expect(parsed.language).toBe('fr');
      expect(parsed.from_language).toBe('en');
      expect(parsed.sessions_requested).toBe(2);
      expect(parsed.sessions_returned).toBe(2);
      expect(parsed.sentences).toHaveLength(3);
      expect(parsed.sentences[0]).toEqual({
        challenge_type: 'translate',
        prompt: 'Où est la gare ?',
        answers: ['Where is the station?'],
        tokens: ['Où', 'est', 'la', 'gare'],
        tts: 'https://example.com/sentence.mp3',
        tts_urls: [
          'https://example.com/sentence.mp3',
          'https://example.com/ou.mp3',
        ],
      });
      expect(parsed.sentences[1]).toMatchObject({
        challenge_type: 'listen',
        prompt: null,
        answers: ['Je voudrais un billet billet'],
        tokens: ['Je', 'voudrais', 'un', 'billet', 'billet'],
        tts: 'https://example.com/je.mp3',
        tts_urls: [
          'https://example.com/je.mp3',
          'https://example.com/billet.mp3',
        ],
      });
      expect(mockClient.getGlobalPracticeSession).toHaveBeenCalledTimes(2);
    });

    it('respects sentence_limit and skips unavailable sessions', async () => {
      vi.mocked(mockClient.getGlobalPracticeSession!)
        .mockReset()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(FIRST_SESSION);

      const result = await callTool(server, 'duolingo_get_practice_sentences', {
        language_abbr: 'fr',
        sessions: 2,
        sentence_limit: 1,
        response_format: 'json',
      });
      const parsed = JSON.parse(result);

      expect(parsed.sessions_returned).toBe(1);
      expect(parsed.sentences).toHaveLength(1);
    });

    it('formats practice sentences as markdown', async () => {
      const result = await callTool(server, 'duolingo_get_practice_sentences', {
        language_abbr: 'fr',
      });

      expect(result).toContain('# Practice Sentences (FR)');
      expect(result).toContain('Où est la gare ?');
      expect(result).toContain('Where is the station?');
    });

    it("derives from_language from the user's matching course", async () => {
      const result = await callTool(server, 'duolingo_get_practice_sentences', {
        language_abbr: 'fr',
        response_format: 'json',
      });
      const parsed = JSON.parse(result);

      expect(parsed.from_language).toBe('de');
      expect(mockClient.getUserDataV2).toHaveBeenCalledWith(12345);
      expect(mockClient.getGlobalPracticeSession).toHaveBeenCalledWith(
        'fr',
        'de',
      );
    });
  });

  describe('duolingo_get_recent_learning', () => {
    it('maps recent XP activity to skills and learned words', async () => {
      const result = await callTool(server, 'duolingo_get_recent_learning', {
        language_abbr: 'fr',
        days: 7,
        response_format: 'json',
      });
      const parsed = JSON.parse(result);

      expect(parsed.language).toBe('fr');
      expect(parsed.days).toBe(7);
      expect(parsed.total_xp).toBe(30);
      expect(parsed.activity_count).toBe(3);
      expect(parsed.skills).toHaveLength(2);
      expect(parsed.skills[0]).toMatchObject({
        id: 'skill-travel',
        title: 'Travel',
        xp: 25,
        lesson_count: 2,
      });
      expect(parsed.words).toEqual(['billet', 'bonjour', 'gare', 'merci']);
      expect(parsed.activities[0]).toMatchObject({
        skill_id: 'skill-travel',
        skill_title: 'Travel',
        xp: 15,
        event_type: 'lesson',
      });
      expect(mockClient.getUserDataById).toHaveBeenCalledWith(12345, [
        'xpGains',
        'streakData',
      ]);
    });

    it('formats recent learning as markdown', async () => {
      const result = await callTool(server, 'duolingo_get_recent_learning', {
        language_abbr: 'fr',
        days: 7,
      });

      expect(result).toContain('# Recent Learning (FR)');
      expect(result).toContain('**Total XP**: 30');
      expect(result).toContain('Travel');
      expect(result).toContain('billet');
    });

    it('returns a clear message for an unknown language', async () => {
      const result = await callTool(server, 'duolingo_get_recent_learning', {
        language_abbr: 'xx',
      });

      expect(result).toContain("Language 'xx' not found");
      expect(mockClient.getUserDataById).not.toHaveBeenCalled();
    });
  });

  describe('duolingo_get_review_material', () => {
    it('prioritizes weak learned topics and combines words with sentences', async () => {
      const result = await callTool(server, 'duolingo_get_review_material', {
        language_abbr: 'fr',
        from_language: 'en',
        topic_limit: 2,
        sessions: 2,
        sentence_limit: 2,
        response_format: 'json',
      });
      const parsed = JSON.parse(result);

      expect(parsed.language).toBe('fr');
      expect(parsed.from_language).toBe('en');
      expect(
        parsed.topics.map((topic: { title: string }) => topic.title),
      ).toEqual(['Travel', 'Food']);
      expect(parsed.topics[0]).toMatchObject({
        id: 'skill-travel',
        strength: 0.35,
      });
      expect(parsed.words).toEqual(['billet', 'eau', 'gare', 'pain']);
      expect(parsed.sentences).toHaveLength(2);
      expect(parsed.sentences[0].prompt).toBe('Où est la gare ?');
      expect(parsed.sessions_requested).toBe(2);
      expect(parsed.sessions_returned).toBe(2);
      expect(parsed.note).toContain('practice session samples');
    });

    it('formats review material as markdown', async () => {
      const result = await callTool(server, 'duolingo_get_review_material', {
        language_abbr: 'fr',
        topic_limit: 1,
        sessions: 1,
        sentence_limit: 1,
      });

      expect(result).toContain('# Review Material (FR)');
      expect(result).toContain('Travel');
      expect(result).toContain('gare');
      expect(result).toContain('Où est la gare ?');
    });

    it('never includes unlearned topics', async () => {
      const result = await callTool(server, 'duolingo_get_review_material', {
        language_abbr: 'fr',
        topic_limit: 10,
        response_format: 'json',
      });
      const parsed = JSON.parse(result);

      expect(
        parsed.topics.map((topic: { title: string }) => topic.title),
      ).not.toContain('Colors');
      expect(parsed.words).not.toContain('rouge');
    });

    it('returns a clear message for an unknown language', async () => {
      const result = await callTool(server, 'duolingo_get_review_material', {
        language_abbr: 'xx',
      });

      expect(result).toContain("Language 'xx' not found");
      expect(mockClient.getGlobalPracticeSession).not.toHaveBeenCalled();
    });
  });

  it('converts client failures into MCP error content', async () => {
    vi.mocked(mockClient.getGlobalPracticeSession!)
      .mockReset()
      .mockRejectedValue(new Error('session unavailable'));

    const result = await callTool(server, 'duolingo_get_practice_sentences', {
      language_abbr: 'fr',
    });

    expect(result).toContain('Error: Unexpected error');
    expect(result).toContain('session unavailable');
  });
});
