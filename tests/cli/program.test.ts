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
    exportVocabulary: vi.fn().mockResolvedValue('exported\n'),
    runDoctor: vi.fn().mockResolvedValue({ ok: true, output: 'healthy' }),
    runCanary: vi.fn().mockResolvedValue({ ok: true, output: 'pass' }),
    runSnapshot: vi.fn().mockResolvedValue('{"enabled":true}'),
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
    expect(deps.output.join('')).toContain('duolingo-cli social leaderboard');
    expect(deps.output.join('')).toContain('duolingo-cli resource hearts');
    expect(deps.output.join('')).toContain('duolingo-cli goal streak');
    expect(deps.output.join('')).toContain('duolingo-cli doctor');
    expect(deps.output.join('')).toContain('duolingo-cli snapshot');
    expect(deps.output.join('')).toContain(
      'language export --language LANG [--username USER]',
    );
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
      argv: ['account', 'settings', '--json'],
      tool: 'duolingo_get_settings',
      args: { response_format: 'json' },
    },
    {
      argv: ['account', 'streak', '--username', 'friend', '--json'],
      tool: 'duolingo_get_streak_info',
      args: { username: 'friend', response_format: 'json' },
    },
    {
      argv: ['account', 'daily-xp', '--json'],
      tool: 'duolingo_get_daily_xp_progress',
      args: { response_format: 'json' },
    },
    {
      argv: ['account', 'calendar', '--username', 'friend'],
      tool: 'duolingo_get_calendar',
      args: { username: 'friend', response_format: 'markdown' },
    },
    {
      argv: ['course', 'list', '--username', 'friend', '--json'],
      tool: 'duolingo_get_courses',
      args: { username: 'friend', response_format: 'json' },
    },
    {
      argv: ['social', 'friends', '--json'],
      tool: 'duolingo_get_friends',
      args: { response_format: 'json' },
    },
    {
      argv: ['social', 'leaderboard', '--unit', 'month', '--json'],
      tool: 'duolingo_get_leaderboard',
      args: { unit: 'month', response_format: 'json' },
    },
    {
      argv: ['resource', 'hearts', '--json'],
      tool: 'duolingo_get_health',
      args: { response_format: 'json' },
    },
    {
      argv: ['resource', 'currencies'],
      tool: 'duolingo_get_currencies',
      args: { response_format: 'markdown' },
    },
    {
      argv: ['shop', 'items', '--json'],
      tool: 'duolingo_get_shop_items',
      args: { response_format: 'json' },
    },
    {
      argv: ['goal', 'streak', '--json'],
      tool: 'duolingo_get_streak_goal',
      args: { response_format: 'json' },
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
      argv: [
        'language',
        'recent-words',
        '--language',
        'ja',
        '--limit',
        '10',
        '--json',
      ],
      tool: 'duolingo_get_recent_words',
      args: { language_abbr: 'ja', limit: 10, response_format: 'json' },
    },
    {
      argv: ['language', 'skills', '--language', 'es'],
      tool: 'duolingo_get_learned_skills',
      args: { language_abbr: 'es', response_format: 'markdown' },
    },
    {
      argv: ['topic', 'words', '--language', 'ja', '--topic', '53', '--json'],
      tool: 'duolingo_get_topic_vocabulary',
      args: {
        language_abbr: 'ja',
        topic_position: 53,
        response_format: 'json',
      },
    },
    {
      argv: [
        'topic',
        'sentences',
        '--language',
        'ja',
        '--topic',
        '53',
        '--sessions',
        '2',
        '--limit',
        '10',
      ],
      tool: 'duolingo_get_topic_practice',
      args: {
        language_abbr: 'ja',
        topic_position: 53,
        sessions: 2,
        sentence_limit: 10,
        response_format: 'markdown',
      },
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

  it('rejects a recent-word limit above 100 before invoking a tool', async () => {
    await expect(
      runCli(
        ['language', 'recent-words', '--language', 'ja', '--limit', '101'],
        deps,
      ),
    ).resolves.toBe(1);
    expect(deps.runTool).not.toHaveBeenCalled();
    expect(deps.errors.join('')).toContain('--limit');
  });

  it('exports vocabulary in an explicit native format', async () => {
    await expect(
      runCli(
        [
          'language',
          'export',
          '--language',
          'ja',
          '--format',
          'anki',
          '--limit',
          '20',
        ],
        deps,
      ),
    ).resolves.toBe(0);
    expect(deps.exportVocabulary).toHaveBeenCalledWith(
      { language: 'ja', format: 'anki', limit: 20 },
      expect.objectContaining({ username: 'stored-user' }),
    );
    expect(deps.output.join('')).toBe('exported\n');
  });

  it('runs doctor and preserves its health exit status', async () => {
    await expect(
      runCli(['doctor', '--language', 'ja', '--json'], deps),
    ).resolves.toBe(0);
    expect(deps.runDoctor).toHaveBeenCalledWith(
      'ja',
      true,
      expect.objectContaining({ source: 'keychain' }),
    );

    vi.mocked(deps.runDoctor).mockResolvedValue({
      ok: false,
      output: 'failed',
    });
    await expect(runCli(['doctor'], deps)).resolves.toBe(1);
  });

  it('lets doctor diagnose missing local credentials', async () => {
    vi.mocked(deps.credentials.resolve).mockResolvedValue(null);
    vi.mocked(deps.runDoctor).mockResolvedValue({
      ok: false,
      output: 'credentials_missing',
    });
    await expect(runCli(['doctor', '--json'], deps)).resolves.toBe(1);
    expect(deps.runDoctor).toHaveBeenCalledWith(undefined, true, null);
  });

  it('lets doctor diagnose credential resolution errors', async () => {
    const resolutionError = new Error('partial credential configuration');
    vi.mocked(deps.credentials.resolve).mockRejectedValue(resolutionError);
    vi.mocked(deps.runDoctor).mockResolvedValue({
      ok: false,
      output: '{"status":"failed","code":"credentials_invalid"}',
    });

    await expect(runCli(['doctor', '--json'], deps)).resolves.toBe(1);
    expect(deps.runDoctor).toHaveBeenCalledWith(
      undefined,
      true,
      null,
      resolutionError,
    );
    expect(deps.errors).toEqual([]);
  });

  it('requires a language for the live canary', async () => {
    await expect(runCli(['canary', '--json'], deps)).resolves.toBe(1);
    expect(deps.runCanary).not.toHaveBeenCalled();
    expect(deps.errors.join('')).toContain('--language');
  });

  it('routes snapshot lifecycle commands', async () => {
    await expect(
      runCli(
        ['snapshot', 'init', '--language', 'ja', '--retention', '30', '--json'],
        deps,
      ),
    ).resolves.toBe(0);
    expect(deps.runSnapshot).toHaveBeenCalledWith(
      {
        action: 'init',
        language: 'ja',
        retention: 30,
        deleteData: false,
        json: true,
      },
      expect.objectContaining({ username: 'stored-user' }),
    );
  });

  it('allows local snapshot status without Duolingo credentials', async () => {
    vi.mocked(deps.credentials.resolve).mockResolvedValue(null);
    await expect(
      runCli(['snapshot', 'status', '--language', 'ja', '--json'], deps),
    ).resolves.toBe(0);
    expect(deps.runSnapshot).toHaveBeenCalledWith(
      {
        action: 'status',
        language: 'ja',
        deleteData: false,
        json: true,
      },
      null,
    );
  });

  it('rejects unsupported leaderboard units before invoking a tool', async () => {
    await expect(
      runCli(['social', 'leaderboard', '--unit', 'year'], deps),
    ).resolves.toBe(1);
    expect(deps.runTool).not.toHaveBeenCalled();
    expect(deps.errors.join('')).toContain('--unit');
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
