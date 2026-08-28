import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VocabularyDataset } from '../../src/contracts/vocabulary.js';
import { SnapshotStore } from '../../src/cli/snapshots.js';

function dataset(capturedAt: string, words: string[]): VocabularyDataset {
  return {
    schema_version: '1',
    source: 'duolingo_learned_lexemes',
    language: 'ja',
    from_language: 'en',
    course_id: 'JA_EN',
    captured_at: capturedAt,
    sort: 'alphabetical',
    count: words.length,
    words: words.map((text, index) => ({
      stable_id: `ja:${text}`,
      rank: index + 1,
      text,
      translations: [`translation-${text}`],
      audio_url: null,
      is_new: null,
    })),
  };
}

describe('SnapshotStore', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'duolingo-snapshots-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('requires explicit opt-in and creates private files', async () => {
    const store = new SnapshotStore({
      root,
      now: () => new Date('2026-08-28T00:00:00.000Z'),
    });
    await expect(
      store.capture(dataset('2026-08-28T00:00:00.000Z', ['一'])),
    ).rejects.toThrow('snapshot init');

    const enabled = await store.enable('ja', 2);
    expect(enabled).toMatchObject({ enabled: true, retention: 2 });
    await store.capture(dataset('2026-08-28T01:00:00.000Z', ['一']));
    const config = JSON.parse(
      await readFile(join(root, 'config.json'), 'utf8'),
    );
    expect(config.languages.ja.retention).toBe(2);
  });

  it('diffs the two latest snapshots and enforces retention', async () => {
    const store = new SnapshotStore({ root });
    await store.enable('ja', 2);
    await store.capture(dataset('2026-08-28T01:00:00.000Z', ['一']));
    await store.capture(dataset('2026-08-28T02:00:00.000Z', ['一', '二']));
    const diff = await store.diff('ja');
    expect(diff.added.map((word) => word.text)).toEqual(['二']);
    expect(diff.removed).toEqual([]);

    await store.capture(dataset('2026-08-28T03:00:00.000Z', ['二']));
    const status = await store.status('ja');
    expect(status.capture_count).toBe(2);
    expect((await store.diff('ja')).removed.map((word) => word.text)).toEqual([
      '一',
    ]);
    expect((await store.diff('ja')).changed).toEqual([]);
  });

  it('can disable and delete local snapshot data', async () => {
    const store = new SnapshotStore({ root });
    await store.enable('ja');
    await store.capture(dataset('2026-08-28T01:00:00.000Z', ['一']));
    const status = await store.disable('ja', true);
    expect(status).toMatchObject({ enabled: false, capture_count: 0 });
  });
});
