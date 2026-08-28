import {
  VocabularyDatasetSchema,
  type VocabularyDataset,
  type VocabularyExportFormat,
} from '../contracts/vocabulary.js';
import type { DuolingoClient } from '../client/duolingo.js';
import {
  DuolingoClientError,
  DuolingoLanguageNotFoundError,
} from '../client/errors.js';
import { courseMatchesLanguage } from '../tools/language-source.js';

export interface VocabularyQueryOptions {
  username?: string;
  sort?: 'alphabetical' | 'learned_date';
  limit?: number;
  now?: () => Date;
}

function stableWordId(language: string, text: string): string {
  const normalized = text.normalize('NFKC').trim().toLowerCase();
  return `${language}:${encodeURIComponent(normalized)}`;
}

/** Fetch a versioned Active Course vocabulary dataset. */
export async function getVocabularyDataset(
  client: DuolingoClient,
  language: string,
  options: VocabularyQueryOptions = {},
): Promise<VocabularyDataset> {
  const userData = await client.getUserData(options.username);
  if (userData.language_data[language] === undefined) {
    throw new DuolingoLanguageNotFoundError(language);
  }

  const course = await client.getCurrentCourse(userData.id);
  if (!courseMatchesLanguage(course, language)) {
    throw new DuolingoClientError(
      `Language '${language}' is not the active Duolingo course. ` +
        'Switch to that course in Duolingo and try again.',
    );
  }

  const sort = options.sort ?? 'alphabetical';
  const lexemes = await client.getLearnedLexemes(
    language,
    course.fromLanguage,
    userData.id,
    {
      sortBy: sort === 'learned_date' ? 'LEARNED_DATE' : 'ALPHABETICAL',
      limit: options.limit,
    },
  );
  const words = lexemes.map((lexeme, index) => ({
    stable_id: stableWordId(language, lexeme.text),
    rank: index + 1,
    text: lexeme.text,
    translations: [...new Set(lexeme.translations)],
    audio_url: lexeme.audioURL ?? null,
    is_new: lexeme.isNew ?? null,
  }));

  return VocabularyDatasetSchema.parse({
    schema_version: '1',
    source: 'duolingo_learned_lexemes',
    language,
    from_language: course.fromLanguage,
    course_id: course.id,
    captured_at: (options.now ?? (() => new Date()))().toISOString(),
    sort,
    count: words.length,
    words,
  });
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

/** Serialize vocabulary without inventing metadata absent from Duolingo. */
export function serializeVocabulary(
  dataset: VocabularyDataset,
  format: VocabularyExportFormat,
): string {
  if (format === 'json') return `${JSON.stringify(dataset, null, 2)}\n`;

  if (format === 'csv') {
    const rows = [
      ['stable_id', 'word', 'translations', 'audio_url', 'is_new'],
      ...dataset.words.map((word) => [
        word.stable_id,
        word.text,
        word.translations.join('; '),
        word.audio_url ?? '',
        word.is_new === null ? '' : String(word.is_new),
      ]),
    ];
    return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
  }

  const rows =
    format === 'anki'
      ? [
          ['Front', 'Back', 'Audio URL', 'Tags', 'Stable ID'],
          ...dataset.words.map((word) => [
            word.text,
            word.translations.join('; '),
            word.audio_url ?? '',
            `duolingo::${dataset.language}`,
            word.stable_id,
          ]),
        ]
      : [
          ['stable_id', 'word', 'translations', 'audio_url', 'is_new'],
          ...dataset.words.map((word) => [
            word.stable_id,
            word.text,
            word.translations.join('; '),
            word.audio_url ?? '',
            word.is_new === null ? '' : String(word.is_new),
          ]),
        ];
  return `${rows.map((row) => row.map(tsvCell).join('\t')).join('\n')}\n`;
}
