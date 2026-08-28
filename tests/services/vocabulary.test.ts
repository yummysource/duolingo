import type { DuolingoClient } from '../../src/client/duolingo.js';
import {
  VocabularyDatasetSchema,
  getVocabularyDataset,
  serializeVocabulary,
} from '../../src/index.js';

function mockClient(): DuolingoClient {
  return {
    getUserData: vi.fn().mockResolvedValue({
      id: 42,
      language_data: { ja: {} },
    }),
    getCurrentCourse: vi.fn().mockResolvedValue({
      id: 'JA_FROM_EN',
      subject: 'language',
      learningLanguage: 'ja',
      topic: 'ja',
      fromLanguage: 'en',
    }),
    getLearnedLexemes: vi.fn().mockResolvedValue([
      {
        text: '日本,語',
        translations: ['Japanese "language"'],
        audioURL: 'https://example.com/ja.mp3',
        isNew: true,
      },
    ]),
  } as unknown as DuolingoClient;
}

describe('vocabulary contract and export', () => {
  it('builds a versioned dataset with stable IDs', async () => {
    const client = mockClient();
    const dataset = await getVocabularyDataset(client, 'ja', {
      sort: 'learned_date',
      limit: 10,
      now: () => new Date('2026-08-28T00:00:00.000Z'),
    });

    expect(VocabularyDatasetSchema.parse(dataset)).toEqual(dataset);
    expect(dataset).toMatchObject({
      schema_version: '1',
      language: 'ja',
      course_id: 'JA_FROM_EN',
      count: 1,
      sort: 'learned_date',
    });
    expect(dataset.words[0]?.stable_id).toBe(
      'ja:%E6%97%A5%E6%9C%AC%2C%E8%AA%9E',
    );
  });

  it('serializes valid CSV, TSV, and Anki-friendly TSV', async () => {
    const dataset = await getVocabularyDataset(mockClient(), 'ja', {
      now: () => new Date('2026-08-28T00:00:00.000Z'),
    });
    expect(serializeVocabulary(dataset, 'csv')).toContain(
      '"日本,語","Japanese ""language"""',
    );
    expect(serializeVocabulary(dataset, 'tsv')).toContain(
      '日本,語\tJapanese "language"',
    );
    const anki = serializeVocabulary(dataset, 'anki');
    expect(anki).toContain('Front\tBack\tAudio URL\tTags\tStable ID');
    expect(anki).toContain('duolingo::ja');
  });
});
