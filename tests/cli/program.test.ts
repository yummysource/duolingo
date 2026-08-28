import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CliDependencies,
  CredentialAccess,
} from '../../src/cli/program.js';
import { runCli } from '../../src/cli/program.js';

function createDependencies(): CliDependencies & {
  output: string[];
  errors: string[];
} {
  const output: string[] = [];
  const errors: string[] = [];
  const credentials: CredentialAccess = {
    resolve: vi.fn().mockResolvedValue({
      username: 'stored-user',
      jwt: 'stored-secret',
      source: 'keychain',
    }),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
  };

  return {
    credentials,
    env: {},
    version: '1.2.3',
    promptText: vi.fn().mockResolvedValue('prompt-user'),
    promptSecret: vi.fn().mockResolvedValue('prompt-secret'),
    validateCredentials: vi.fn().mockResolvedValue(undefined),
    runTool: vi.fn().mockResolvedValue('{"ok":true}'),
    startMcp: vi.fn().mockResolvedValue(undefined),
    stdout: (text) => output.push(text),
    stderr: (text) => errors.push(text),
    output,
    errors,
  };
}

describe('runCli', () => {
  let deps: ReturnType<typeof createDependencies>;

  beforeEach(() => {
    deps = createDependencies();
  });

  it('prints top-level help', async () => {
    await expect(runCli(['--help'], deps)).resolves.toBe(0);
    expect(deps.output.join('')).toContain('duolingo-cli auth');
    expect(deps.output.join('')).toContain('duolingo-cli review');
    expect(deps.errors).toEqual([]);
  });

  it('prints the CLI version', async () => {
    await expect(runCli(['--version'], deps)).resolves.toBe(0);
    expect(deps.output.join('')).toBe('1.2.3\n');
  });

  it('auth init validates before saving and never prints the JWT', async () => {
    await expect(runCli(['auth', 'init'], deps)).resolves.toBe(0);

    expect(deps.validateCredentials).toHaveBeenCalledWith({
      username: 'prompt-user',
      jwt: 'prompt-secret',
    });
    expect(deps.credentials.save).toHaveBeenCalledWith({
      username: 'prompt-user',
      jwt: 'prompt-secret',
    });
    expect(deps.output.join('')).not.toContain('prompt-secret');
    expect(deps.errors.join('')).not.toContain('prompt-secret');
  });

  it('auth show --status emits an exact machine-readable state', async () => {
    await expect(runCli(['auth', 'show', '--status'], deps)).resolves.toBe(0);
    expect(deps.output.join('')).toBe('authorized\n');
  });

  it('auth show --status exits non-zero when unauthenticated', async () => {
    vi.mocked(deps.credentials.resolve).mockResolvedValue(null);

    await expect(runCli(['auth', 'show', '--status'], deps)).resolves.toBe(1);
    expect(deps.output.join('')).toBe('unauthorized\n');
  });

  it('auth show identifies the username and source without printing the JWT', async () => {
    await expect(runCli(['auth', 'show'], deps)).resolves.toBe(0);
    const output = deps.output.join('');
    expect(output).toContain('stored-user');
    expect(output).toContain('system keychain');
    expect(output).not.toContain('stored-secret');
  });

  it('auth logout removes stored credentials', async () => {
    await expect(runCli(['auth', 'logout'], deps)).resolves.toBe(0);
    expect(deps.credentials.delete).toHaveBeenCalledOnce();
  });

  it.each([
    {
      argv: ['account', 'profile', '--username', 'friend', '--json'],
      tool: 'duolingo_get_user_info',
      args: { username: 'friend', response_format: 'json' },
    },
    {
      argv: ['language', 'list', '--abbreviations', '--json'],
      tool: 'duolingo_get_languages',
      args: { abbreviations: true, response_format: 'json' },
    },
    {
      argv: ['language', 'words', '--language', 'es', '--json'],
      tool: 'duolingo_get_known_words',
      args: { language_abbr: 'es', response_format: 'json' },
    },
    {
      argv: ['language', 'skills', '--language', 'es'],
      tool: 'duolingo_get_learned_skills',
      args: { language_abbr: 'es', response_format: 'markdown' },
    },
    {
      argv: ['review', 'recent', '--language', 'es', '--days', '7', '--json'],
      tool: 'duolingo_get_recent_learning',
      args: { language_abbr: 'es', days: 7, response_format: 'json' },
    },
    {
      argv: [
        'review',
        'sentences',
        '--language',
        'es',
        '--from',
        'en',
        '--sessions',
        '2',
        '--limit',
        '10',
        '--json',
      ],
      tool: 'duolingo_get_practice_sentences',
      args: {
        language_abbr: 'es',
        from_language: 'en',
        sessions: 2,
        sentence_limit: 10,
        response_format: 'json',
      },
    },
    {
      argv: [
        'review',
        'material',
        '--language',
        'es',
        '--topics',
        '4',
        '--sessions',
        '3',
        '--limit',
        '10',
        '--json',
      ],
      tool: 'duolingo_get_review_material',
      args: {
        language_abbr: 'es',
        topic_limit: 4,
        sessions: 3,
        sentence_limit: 10,
        response_format: 'json',
      },
    },
  ])('maps $argv to the read-only $tool tool', async ({ argv, tool, args }) => {
    await expect(runCli(argv, deps)).resolves.toBe(0);
    expect(deps.runTool).toHaveBeenCalledWith(
      tool,
      args,
      expect.objectContaining({ username: 'stored-user' }),
    );
    expect(deps.output.join('')).toContain('{"ok":true}');
  });

  it('rejects out-of-range numeric options before invoking a tool', async () => {
    await expect(
      runCli(['review', 'recent', '--language', 'es', '--days', '0'], deps),
    ).resolves.toBe(1);
    expect(deps.runTool).not.toHaveBeenCalled();
    expect(deps.errors.join('')).toContain('--days');
  });

  it('guides unauthenticated users to the interactive auth flow', async () => {
    vi.mocked(deps.credentials.resolve).mockResolvedValue(null);

    await expect(
      runCli(['review', 'recent', '--language', 'es'], deps),
    ).resolves.toBe(1);
    expect(deps.errors.join('')).toContain('duolingo-cli auth init');
    expect(deps.runTool).not.toHaveBeenCalled();
  });

  it('starts MCP mode with resolved credentials', async () => {
    await expect(runCli(['mcp'], deps)).resolves.toBe(0);
    expect(deps.startMcp).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'stored-user' }),
    );
  });

  it('rejects unknown commands without exposing a stack trace', async () => {
    await expect(runCli(['review', 'invented'], deps)).resolves.toBe(1);
    expect(deps.errors.join('')).toContain('Unknown command');
    expect(deps.errors.join('')).not.toContain('at runCli');
  });
});
