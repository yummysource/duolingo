import { z } from 'zod';

/** Stable vocabulary record shared by the API, CLI, and MCP interfaces. */
export const VocabularyWordSchema = z.object({
  stable_id: z.string().min(1),
  rank: z.number().int().positive(),
  text: z.string().min(1),
  translations: z.array(z.string()),
  audio_url: z.string().url().nullable(),
  is_new: z.boolean().nullable(),
});

/** Versioned vocabulary dataset returned by every structured interface. */
export const VocabularyDatasetSchema = z.object({
  schema_version: z.literal('1'),
  source: z.literal('duolingo_learned_lexemes'),
  language: z.string().min(2),
  from_language: z.string().min(2),
  course_id: z.string().min(1),
  captured_at: z.string().datetime(),
  sort: z.enum(['alphabetical', 'learned_date']),
  count: z.number().int().nonnegative(),
  words: z.array(VocabularyWordSchema),
});

export type VocabularyWord = z.infer<typeof VocabularyWordSchema>;
export type VocabularyDataset = z.infer<typeof VocabularyDatasetSchema>;

export const VocabularyExportFormatSchema = z.enum([
  'json',
  'csv',
  'tsv',
  'anki',
]);

export type VocabularyExportFormat = z.infer<
  typeof VocabularyExportFormatSchema
>;
