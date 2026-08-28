import type { DuolingoClient } from '../../src/client/duolingo.js';
import { runLiveCanary } from '../../src/diagnostics/canary.js';

function client(points: number): DuolingoClient {
  return {
    getUserData: vi.fn().mockResolvedValue({
      id: 42,
      site_streak: 100,
      language_data: {
        ja: { points, calendar: [] },
      },
    }),
    getCurrentCourse: vi.fn().mockResolvedValue({
      id: 'JA_EN',
      subject: 'language',
      topic: 'ja',
      learningLanguage: 'ja',
      fromLanguage: 'en',
    }),
    getHealth: vi.fn().mockResolvedValue({ hearts: 5 }),
    getCurrencies: vi.fn().mockResolvedValue({ gems: 10, lingots: 2 }),
    getLearnedLexemes: vi.fn().mockResolvedValue([]),
  } as unknown as DuolingoClient;
}

describe('runLiveCanary', () => {
  it('passes when critical state is unchanged', async () => {
    const result = await runLiveCanary(
      () => client(200),
      'ja',
      () => new Date('2026-08-28T00:00:00.000Z'),
    );
    expect(result).toMatchObject({ status: 'pass', changed_fields: [] });
  });

  it('reports fields that changed during the read canary', async () => {
    const clients = [client(200), client(210)];
    const result = await runLiveCanary(() => clients.shift()!, 'ja');
    expect(result.status).toBe('changed');
    expect(result.changed_fields).toContain('language_xp');
  });
});
