import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  VocabularyDatasetSchema,
  type VocabularyDataset,
  type VocabularyWord,
} from '../contracts/vocabulary.js';
import { getDefaultConfigDir } from './credentials.js';

const LanguageSchema = z.string().regex(/^[A-Za-z][A-Za-z-]{1,9}$/);
const SnapshotConfigSchema = z.object({
  schema_version: z.literal('1'),
  languages: z.record(
    z.object({
      enabled_at: z.string().datetime(),
      retention: z.number().int().min(2).max(365),
    }),
  ),
});

type SnapshotConfig = z.infer<typeof SnapshotConfigSchema>;

function comparableWord(word: VocabularyWord): string {
  return JSON.stringify({
    stable_id: word.stable_id,
    text: word.text,
    translations: word.translations,
    audio_url: word.audio_url,
    is_new: word.is_new,
  });
}

export interface SnapshotStatus {
  schema_version: '1';
  language: string;
  enabled: boolean;
  enabled_at: string | null;
  retention: number | null;
  capture_count: number;
  latest_capture: string | null;
}

export interface SnapshotDiff {
  schema_version: '1';
  language: string;
  from: string;
  to: string;
  added: VocabularyWord[];
  removed: VocabularyWord[];
  changed: { before: VocabularyWord; after: VocabularyWord }[];
}

function isFileNotFound(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

export class SnapshotStore {
  private readonly root: string;
  private readonly configPath: string;
  private readonly now: () => Date;

  constructor(options: { root?: string; now?: () => Date } = {}) {
    this.root = options.root ?? join(getDefaultConfigDir(), 'snapshots');
    this.configPath = join(this.root, 'config.json');
    this.now = options.now ?? (() => new Date());
  }

  async enable(languageInput: string, retention = 90): Promise<SnapshotStatus> {
    const language = LanguageSchema.parse(languageInput);
    if (!Number.isInteger(retention) || retention < 2 || retention > 365) {
      throw new RangeError('Snapshot retention must be between 2 and 365.');
    }
    const config = await this.readConfig();
    config.languages[language] = {
      enabled_at:
        config.languages[language]?.enabled_at ?? this.now().toISOString(),
      retention,
    };
    await this.writeConfig(config);
    await this.ensureDirectory(join(this.root, language));
    return this.status(language);
  }

  async disable(
    languageInput: string,
    deleteData = false,
  ): Promise<SnapshotStatus> {
    const language = LanguageSchema.parse(languageInput);
    const config = await this.readConfig();
    const { [language]: _removed, ...remainingLanguages } = config.languages;
    config.languages = remainingLanguages;
    await this.writeConfig(config);
    if (deleteData) {
      await rm(join(this.root, language), { recursive: true, force: true });
    }
    return this.status(language);
  }

  async capture(dataset: VocabularyDataset): Promise<SnapshotStatus> {
    const parsed = VocabularyDatasetSchema.parse(dataset);
    const language = LanguageSchema.parse(parsed.language);
    const config = await this.readConfig();
    const settings = config.languages[language];
    if (settings === undefined) {
      throw new Error(
        `Snapshots are not enabled for '${language}'. Run snapshot init first.`,
      );
    }
    const directory = join(this.root, language);
    await this.ensureDirectory(directory);
    const timestamp = parsed.captured_at.replaceAll(':', '-');
    await this.atomicWrite(
      join(directory, `${timestamp}.json`),
      `${JSON.stringify(parsed, null, 2)}\n`,
    );
    const files = await this.snapshotFiles(language);
    const excess = files.slice(
      0,
      Math.max(0, files.length - settings.retention),
    );
    for (const file of excess) await unlink(join(directory, file));
    return this.status(language);
  }

  async status(languageInput: string): Promise<SnapshotStatus> {
    const language = LanguageSchema.parse(languageInput);
    const config = await this.readConfig();
    const settings = config.languages[language];
    const snapshots = await this.readSnapshots(language);
    return {
      schema_version: '1',
      language,
      enabled: settings !== undefined,
      enabled_at: settings?.enabled_at ?? null,
      retention: settings?.retention ?? null,
      capture_count: snapshots.length,
      latest_capture: snapshots.at(-1)?.captured_at ?? null,
    };
  }

  async diff(languageInput: string): Promise<SnapshotDiff> {
    const language = LanguageSchema.parse(languageInput);
    const snapshots = await this.readSnapshots(language);
    const before = snapshots.at(-2);
    const after = snapshots.at(-1);
    if (before === undefined || after === undefined) {
      throw new Error(
        `At least two snapshots are required for '${language}' before diffing.`,
      );
    }
    const beforeById = new Map(
      before.words.map((word) => [word.stable_id, word]),
    );
    const afterById = new Map(
      after.words.map((word) => [word.stable_id, word]),
    );
    const added = after.words.filter((word) => !beforeById.has(word.stable_id));
    const removed = before.words.filter(
      (word) => !afterById.has(word.stable_id),
    );
    const changed: SnapshotDiff['changed'] = [];
    for (const word of after.words) {
      const previous = beforeById.get(word.stable_id);
      if (
        previous !== undefined &&
        comparableWord(previous) !== comparableWord(word)
      ) {
        changed.push({ before: previous, after: word });
      }
    }
    return {
      schema_version: '1',
      language,
      from: before.captured_at,
      to: after.captured_at,
      added,
      removed,
      changed,
    };
  }

  private async readConfig(): Promise<SnapshotConfig> {
    try {
      const value: unknown = JSON.parse(
        await readFile(this.configPath, 'utf8'),
      );
      return SnapshotConfigSchema.parse(value);
    } catch (error) {
      if (isFileNotFound(error)) {
        return { schema_version: '1', languages: {} };
      }
      throw error;
    }
  }

  private async writeConfig(config: SnapshotConfig): Promise<void> {
    await this.ensureDirectory(this.root);
    await this.atomicWrite(
      this.configPath,
      `${JSON.stringify(SnapshotConfigSchema.parse(config), null, 2)}\n`,
    );
  }

  private async snapshotFiles(language: string): Promise<string[]> {
    try {
      return (await readdir(join(this.root, language)))
        .filter((file) => file.endsWith('.json'))
        .sort();
    } catch (error) {
      if (isFileNotFound(error)) return [];
      throw error;
    }
  }

  private async readSnapshots(language: string): Promise<VocabularyDataset[]> {
    const directory = join(this.root, language);
    const snapshots: VocabularyDataset[] = [];
    for (const file of await this.snapshotFiles(language)) {
      const value: unknown = JSON.parse(
        await readFile(join(directory, file), 'utf8'),
      );
      snapshots.push(VocabularyDatasetSchema.parse(value));
    }
    return snapshots.sort((a, b) => a.captured_at.localeCompare(b.captured_at));
  }

  private async ensureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o700 });
    await chmod(path, 0o700);
  }

  private async atomicWrite(path: string, value: string): Promise<void> {
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, value, { encoding: 'utf8', mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  }
}

export function formatSnapshot(value: SnapshotStatus | SnapshotDiff): string {
  if ('enabled' in value) {
    return [
      `# Vocabulary Snapshots (${value.language.toUpperCase()})`,
      '',
      `- **Enabled**: ${value.enabled}`,
      `- **Retention**: ${value.retention ?? 'not configured'}`,
      `- **Captures**: ${value.capture_count}`,
      `- **Latest**: ${value.latest_capture ?? 'none'}`,
    ].join('\n');
  }
  return [
    `# Vocabulary Diff (${value.language.toUpperCase()})`,
    '',
    `- **From**: ${value.from}`,
    `- **To**: ${value.to}`,
    `- **Added**: ${value.added.length}`,
    `- **Removed**: ${value.removed.length}`,
    `- **Changed**: ${value.changed.length}`,
    '',
    ...value.added.map((word) => `- + ${word.text}`),
    ...value.removed.map((word) => `- - ${word.text}`),
  ].join('\n');
}
