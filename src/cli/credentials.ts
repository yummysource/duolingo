import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { AsyncEntry } from '@napi-rs/keyring';
import { z } from 'zod';

const KEYCHAIN_SERVICE = 'duolingo-learn';
const CONFIG_FILENAME = 'credentials.json';
const CredentialConfigSchema = z.object({ username: z.string().min(1) });

export interface DuolingoCredentials {
  username: string;
  jwt: string;
}

export interface ResolvedCredentials extends DuolingoCredentials {
  source: 'environment' | 'keychain';
}

export interface CredentialVault {
  getPassword: (service: string, account: string) => Promise<string | null>;
  setPassword: (
    service: string,
    account: string,
    password: string,
  ) => Promise<void>;
  deletePassword: (service: string, account: string) => Promise<boolean>;
}

export class CredentialConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialConfigurationError';
  }
}

export class SystemCredentialVault implements CredentialVault {
  async getPassword(service: string, account: string): Promise<string | null> {
    const value = await new AsyncEntry(service, account).getPassword();
    return value ?? null;
  }

  async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    await new AsyncEntry(service, account).setPassword(password);
  }

  async deletePassword(service: string, account: string): Promise<boolean> {
    return new AsyncEntry(service, account).deleteCredential();
  }
}

interface CredentialStoreOptions {
  configDir?: string;
  vault?: CredentialVault;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isFileNotFound(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

export function getDefaultConfigDir(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const explicit = env.DUOLINGO_LEARN_CONFIG_DIR?.trim();
  if (explicit) return explicit;

  if (process.platform === 'win32') {
    const appData = env.APPDATA?.trim();
    if (appData) return join(appData, 'duolingo-learn');
  }

  const xdgConfig = env.XDG_CONFIG_HOME?.trim();
  const configRoot =
    xdgConfig !== undefined && xdgConfig.length > 0
      ? xdgConfig
      : join(homedir(), '.config');
  return join(configRoot, 'duolingo-learn');
}

export class CredentialStore {
  private readonly configPath: string;
  private readonly vault: CredentialVault;

  constructor(options: CredentialStoreOptions = {}) {
    const configDir = options.configDir ?? getDefaultConfigDir();
    this.configPath = join(configDir, CONFIG_FILENAME);
    this.vault = options.vault ?? new SystemCredentialVault();
  }

  async resolve(
    env: Readonly<Record<string, string | undefined>> = process.env,
  ): Promise<ResolvedCredentials | null> {
    const username = env.DUOLINGO_USERNAME?.trim();
    const jwt = env.DUOLINGO_JWT;
    const hasUsername = username !== undefined && username.length > 0;
    const hasJwt = jwt !== undefined && jwt.length > 0;

    if (hasUsername !== hasJwt) {
      throw new CredentialConfigurationError(
        'DUOLINGO_USERNAME and DUOLINGO_JWT must be set together.',
      );
    }
    if (hasUsername && hasJwt) {
      return { username, jwt, source: 'environment' };
    }

    const config = await this.readConfig();
    if (config === null) return null;
    const storedJwt = await this.vault.getPassword(
      KEYCHAIN_SERVICE,
      config.username,
    );
    if (storedJwt === null || storedJwt.length === 0) return null;

    return {
      username: config.username,
      jwt: storedJwt,
      source: 'keychain',
    };
  }

  async save(credentials: DuolingoCredentials): Promise<void> {
    const username = credentials.username.trim();
    if (username.length === 0 || credentials.jwt.length === 0) {
      throw new CredentialConfigurationError(
        'Username and JWT are both required.',
      );
    }

    const previous = await this.readConfig();
    await this.vault.setPassword(KEYCHAIN_SERVICE, username, credentials.jwt);
    await this.writeConfig(username);

    if (previous !== null && previous.username !== username) {
      await this.vault.deletePassword(KEYCHAIN_SERVICE, previous.username);
    }
  }

  async delete(): Promise<boolean> {
    const config = await this.readConfig();
    if (config === null) return false;

    const deleted = await this.vault.deletePassword(
      KEYCHAIN_SERVICE,
      config.username,
    );
    try {
      await unlink(this.configPath);
    } catch (error) {
      if (!isFileNotFound(error)) throw error;
    }
    return deleted;
  }

  private async readConfig(): Promise<{ username: string } | null> {
    try {
      const value: unknown = JSON.parse(
        await readFile(this.configPath, 'utf8'),
      );
      return CredentialConfigSchema.parse(value);
    } catch (error) {
      if (isFileNotFound(error)) return null;
      throw error;
    }
  }

  private async writeConfig(username: string): Promise<void> {
    const configDir = dirname(this.configPath);
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    await chmod(configDir, 0o700);

    const temporaryPath = `${this.configPath}.${process.pid}.tmp`;
    await writeFile(
      temporaryPath,
      `${JSON.stringify({ username }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.configPath);
  }
}
