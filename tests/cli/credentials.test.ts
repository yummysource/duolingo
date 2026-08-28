import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CredentialConfigurationError,
  CredentialStore,
  type CredentialVault,
} from '../../src/cli/credentials.js';

function createVault(): CredentialVault {
  return {
    getPassword: vi.fn().mockResolvedValue(null),
    setPassword: vi.fn().mockResolvedValue(undefined),
    deletePassword: vi.fn().mockResolvedValue(false),
  };
}

describe('CredentialStore', () => {
  const tempDirs: string[] = [];

  async function createStore(vault = createVault()): Promise<{
    configDir: string;
    store: CredentialStore;
    vault: CredentialVault;
  }> {
    const configDir = await mkdtemp(join(tmpdir(), 'duolingo-learn-test-'));
    tempDirs.push(configDir);
    return {
      configDir,
      store: new CredentialStore({ configDir, vault }),
      vault,
    };
  }

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await Promise.all(
      tempDirs.splice(0).map((dir) =>
        rm(dir, {
          recursive: true,
          force: true,
        }),
      ),
    );
  });

  it('prefers complete environment credentials without reading the vault', async () => {
    const { store, vault } = await createStore();

    await expect(
      store.resolve({
        DUOLINGO_USERNAME: 'env-user',
        DUOLINGO_JWT: 'env-secret',
      }),
    ).resolves.toEqual({
      username: 'env-user',
      jwt: 'env-secret',
      source: 'environment',
    });
    expect(vault.getPassword).not.toHaveBeenCalled();
  });

  it('rejects partial environment credentials without exposing the value', async () => {
    const { store } = await createStore();

    const operation = store.resolve({ DUOLINGO_JWT: 'never-print-this' });

    await expect(operation).rejects.toBeInstanceOf(
      CredentialConfigurationError,
    );
    await expect(operation).rejects.not.toThrow('never-print-this');
  });

  it('stores the JWT in the vault and only the username in an owner-only config file', async () => {
    const { configDir, store, vault } = await createStore();

    await store.save({ username: 'stored-user', jwt: 'stored-secret' });

    expect(vault.setPassword).toHaveBeenCalledWith(
      'duolingo-learn',
      'stored-user',
      'stored-secret',
    );
    const configPath = join(configDir, 'credentials.json');
    const contents = await readFile(configPath, 'utf8');
    expect(JSON.parse(contents)).toEqual({ username: 'stored-user' });
    expect(contents).not.toContain('stored-secret');
    expect((await stat(configPath)).mode & 0o777).toBe(0o600);
  });

  it('resolves stored credentials through the vault', async () => {
    const vault = createVault();
    vi.mocked(vault.getPassword).mockResolvedValue('stored-secret');
    const { store } = await createStore(vault);
    await store.save({ username: 'stored-user', jwt: 'initial-secret' });

    await expect(store.resolve({})).resolves.toEqual({
      username: 'stored-user',
      jwt: 'stored-secret',
      source: 'keychain',
    });
  });

  it('returns null when no complete credentials exist', async () => {
    const { store } = await createStore();

    await expect(store.resolve({})).resolves.toBeNull();
  });

  it('deletes the vault entry and local username metadata on logout', async () => {
    const vault = createVault();
    vi.mocked(vault.deletePassword).mockResolvedValue(true);
    const { configDir, store } = await createStore(vault);
    await store.save({ username: 'stored-user', jwt: 'stored-secret' });

    await expect(store.delete()).resolves.toBe(true);
    expect(vault.deletePassword).toHaveBeenCalledWith(
      'duolingo-learn',
      'stored-user',
    );
    await expect(
      readFile(join(configDir, 'credentials.json'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
