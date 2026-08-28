import type { DuolingoClient } from '../client/duolingo.js';
import {
  CanaryResultSchema,
  type CanaryResult,
} from '../contracts/diagnostics.js';
import { DuolingoLanguageNotFoundError } from '../client/errors.js';
import { getVocabularyDataset } from '../services/vocabulary.js';

type ClientFactory = () => DuolingoClient;

async function captureState(client: DuolingoClient, language: string) {
  const user = await client.getUserData();
  const languageData = user.language_data[language];
  if (languageData === undefined) {
    throw new DuolingoLanguageNotFoundError(language);
  }
  const [course, health, currencies] = await Promise.all([
    client.getCurrentCourse(user.id),
    client.getHealth(),
    client.getCurrencies(),
  ]);
  return {
    language_xp: languageData.points,
    streak: user.site_streak,
    calendar_entries: languageData.calendar.length,
    course_id: course.id,
    hearts: health.hearts,
    gems: currencies.gems,
    lingots: currencies.lingots,
  };
}

/** Run critical reads and verify that observable account state is unchanged. */
export async function runLiveCanary(
  createClient: ClientFactory,
  language: string,
  now: () => Date = () => new Date(),
): Promise<CanaryResult> {
  const beforeClient = createClient();
  const before = await captureState(beforeClient, language);
  const vocabulary = await getVocabularyDataset(beforeClient, language, {
    limit: 1,
  });
  const after = await captureState(createClient(), language);
  const changedFields = Object.keys(before).filter(
    (key) =>
      before[key as keyof typeof before] !== after[key as keyof typeof after],
  );
  return CanaryResultSchema.parse({
    schema_version: '1',
    status: changedFields.length === 0 ? 'pass' : 'changed',
    language,
    checked_at: now().toISOString(),
    vocabulary_probe_count: vocabulary.count,
    changed_fields: changedFields,
    before,
    after,
  });
}

export function formatCanary(result: CanaryResult): string {
  return [
    `# Duolingo Live Canary — ${result.status}`,
    '',
    `- **Language**: ${result.language}`,
    `- **Vocabulary probe**: ${result.vocabulary_probe_count}`,
    `- **Changed fields**: ${result.changed_fields.join(', ') || 'none'}`,
  ].join('\n');
}
