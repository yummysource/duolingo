import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import { registerTopicTools } from '../../src/tools/topic.js';
import { callTool } from '../helpers.js';

describe('Topic Tools', () => {
  let server: McpServer;
  let mockClient: Partial<DuolingoClient>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '1.0.0' });
    mockClient = {
      getUserData: vi.fn().mockResolvedValue({ id: 12345 }),
      getCurrentCourse: vi.fn().mockResolvedValue({
        id: 'course-ja-zh',
        subject: 'language',
        topic: 'ja',
        learningLanguage: 'ja',
        fromLanguage: 'zh-CN',
        title: 'Japanese',
        treeId: 'tree-ja-zh',
        skills: [
          {
            id: 'skill-okinawa',
            name: 'Okinawa',
            shortName: 'Okinawa',
            levels: 6,
            finishedLevels: 2,
            strength: 0.75,
          },
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
                    state: 'unit_test',
                    finishedSessions: 2,
                    totalSessions: 6,
                    pathLevelClientData: { skillId: 'skill-okinawa' },
                    pathLevelMetadata: { treeId: 'tree-ja-zh' },
                  },
                ],
              },
            ],
          },
        ],
      }),
      getSkillLearnedLexemes: vi
        .fn()
        .mockResolvedValue([{ text: '沖縄', translations: ['Okinawa'] }]),
      getSkillPracticeSession: vi.fn().mockResolvedValue({
        challenges: [
          {
            type: 'translate',
            prompt: '沖縄へ行きます。',
            correctSolutions: ['I am going to Okinawa.'],
          },
        ],
      }),
    };
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue(
      mockClient as DuolingoClient,
    );
    registerTopicTools(server);
  });

  it('returns topic vocabulary as JSON', async () => {
    const output = await callTool(server, 'duolingo_get_topic_vocabulary', {
      language_abbr: 'ja',
      topic_position: 1,
      response_format: 'json',
    });
    const parsed = JSON.parse(output);

    expect(parsed.topic.title).toBe('Okinawa');
    expect(parsed.words[0]).toMatchObject({ text: '沖縄' });
    expect(parsed.note).toContain('selected topic');
  });

  it('returns topic practice text and an explicit generated-sample note', async () => {
    const output = await callTool(server, 'duolingo_get_topic_practice', {
      language_abbr: 'ja',
      topic_position: 1,
      sessions: 2,
      sentence_limit: 10,
      response_format: 'json',
    });
    const parsed = JSON.parse(output);

    expect(parsed.sentences[0].prompt).toBe('沖縄へ行きます。');
    expect(parsed.note).toContain('current topic-scoped');
    expect(parsed.note).toContain('does not submit');
  });

  it('formats topic vocabulary as Markdown', async () => {
    const output = await callTool(server, 'duolingo_get_topic_vocabulary', {
      language_abbr: 'ja',
      topic_position: 1,
    });

    expect(output).toContain('# Topic 1: Okinawa');
    expect(output).toContain('沖縄');
  });

  it('returns validation and lookup errors as tool content', async () => {
    const output = await callTool(server, 'duolingo_get_topic_vocabulary', {
      language_abbr: 'ja',
      topic_position: 2,
    });

    expect(output).toContain('Error:');
    expect(output).toContain('does not exist');
  });
});
