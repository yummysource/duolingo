import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DuolingoAuthError } from '../../src/client/errors.js';
import type { DuolingoClient } from '../../src/client/duolingo.js';
import * as duolingoModule from '../../src/client/duolingo.js';
import { CliToolError, runMcpTool } from '../../src/cli/tool-runner.js';

describe('runMcpTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DUOLINGO_USERNAME;
    delete process.env.DUOLINGO_JWT;
    duolingoModule.resetClient();
  });

  it('calls a registered tool in memory and restores process credentials', async () => {
    process.env.DUOLINGO_USERNAME = 'original-user';
    process.env.DUOLINGO_JWT = 'original-secret';
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue({
      getUserData: vi.fn().mockResolvedValue({ id: 123 }),
      getUserDataV2: vi.fn().mockResolvedValue({
        courses: [
          {
            subject: 'language',
            topic: 'es',
            learningLanguage: 'es',
            title: 'Spanish',
          },
        ],
      }),
    } as unknown as DuolingoClient);

    await expect(
      runMcpTool(
        'duolingo_get_language_from_abbr',
        { language_abbr: 'es' },
        { username: 'cli-user', jwt: 'cli-secret' },
      ),
    ).resolves.toBe('Spanish');
    expect(process.env.DUOLINGO_USERNAME).toBe('original-user');
    expect(process.env.DUOLINGO_JWT).toBe('original-secret');
  });

  it('turns tool-level error text into a CLI failure', async () => {
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue({
      getUserData: vi
        .fn()
        .mockRejectedValue(new DuolingoAuthError('JWT expired.')),
    } as unknown as DuolingoClient);

    const operation = runMcpTool(
      'duolingo_get_user_info',
      {},
      { username: 'cli-user', jwt: 'cli-secret' },
    );

    await expect(operation).rejects.toBeInstanceOf(CliToolError);
    await expect(operation).rejects.toThrow('JWT expired');
  });

  it('restores process credentials even when transport cleanup fails', async () => {
    process.env.DUOLINGO_USERNAME = 'original-user';
    process.env.DUOLINGO_JWT = 'original-secret';
    vi.spyOn(duolingoModule, 'getClient').mockReturnValue({
      getUserData: vi.fn().mockResolvedValue({ id: 123 }),
      getUserDataV2: vi.fn().mockResolvedValue({
        courses: [
          {
            subject: 'language',
            topic: 'es',
            learningLanguage: 'es',
            title: 'Spanish',
          },
        ],
      }),
    } as unknown as DuolingoClient);
    vi.spyOn(Client.prototype, 'close').mockRejectedValueOnce(
      new Error('cleanup failed'),
    );

    await expect(
      runMcpTool(
        'duolingo_get_language_from_abbr',
        { language_abbr: 'es' },
        { username: 'cli-user', jwt: 'cli-secret' },
      ),
    ).rejects.toThrow('cleanup failed');
    expect(process.env.DUOLINGO_USERNAME).toBe('original-user');
    expect(process.env.DUOLINGO_JWT).toBe('original-secret');
  });
});
