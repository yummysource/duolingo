import type {
  DuolingoCredentials,
  ResolvedCredentials,
} from './credentials.js';

const HELP = `duolingo-cli - read-only Duolingo learning data

Usage:
  duolingo-cli auth init|show|logout
  duolingo-cli account profile [--username USER] [--json]
  duolingo-cli account settings [--json]
  duolingo-cli account streak [--username USER] [--json]
  duolingo-cli account daily-xp [--json]
  duolingo-cli account calendar [--username USER] [--json]
  duolingo-cli course list [--username USER] [--json]
  duolingo-cli social friends [--json]
  duolingo-cli social leaderboard [--unit week|month] [--json]
  duolingo-cli resource hearts|currencies [--json]
  duolingo-cli shop items [--json]
  duolingo-cli goal streak [--json]
  duolingo-cli language list [--username USER] [--abbreviations] [--json]
  duolingo-cli language words --language LANG [--username USER] [--json]
  duolingo-cli language recent-words --language LANG [--limit N] [--username USER] [--json]
  duolingo-cli language skills --language LANG [--username USER] [--json]
  duolingo-cli review recent --language LANG [--days N] [--json]
  duolingo-cli review sentences --language LANG [--from LANG] [--sessions N] [--limit N] [--json]
  duolingo-cli review material --language LANG [--from LANG] [--topics N] [--sessions N] [--limit N] [--json]
  duolingo-cli mcp

Global options:
  --help       Show help
  --version    Show version
`;

export interface CredentialAccess {
  resolve: (
    env?: Readonly<Record<string, string | undefined>>,
  ) => Promise<ResolvedCredentials | null>;
  save: (credentials: DuolingoCredentials) => Promise<void>;
  delete: () => Promise<boolean>;
}

export interface CliDependencies {
  credentials: CredentialAccess;
  env: Readonly<Record<string, string | undefined>>;
  version: string;
  promptText: (label: string) => Promise<string>;
  promptSecret: (label: string) => Promise<string>;
  validateCredentials: (credentials: DuolingoCredentials) => Promise<void>;
  runTool: (
    toolName: string,
    args: Record<string, unknown>,
    credentials: DuolingoCredentials,
  ) => Promise<string>;
  startMcp: (credentials: DuolingoCredentials) => Promise<void>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

interface ParsedOptions {
  flags: Set<string>;
  values: Map<string, string>;
}

interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
}

function writeLine(write: (text: string) => void, text: string): void {
  write(text.endsWith('\n') ? text : `${text}\n`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseOptions(
  tokens: string[],
  valueOptions: readonly string[],
  booleanOptions: readonly string[],
): ParsedOptions {
  const allowedValues = new Set(valueOptions);
  const allowedFlags = new Set(booleanOptions);
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined) continue;
    if (allowedFlags.has(token)) {
      if (flags.has(token))
        throw new CliUsageError(`Duplicate option: ${token}`);
      flags.add(token);
      continue;
    }
    if (!allowedValues.has(token)) {
      throw new CliUsageError(`Unknown option or argument: ${token}`);
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CliUsageError(`Option ${token} requires a value.`);
    }
    if (values.has(token))
      throw new CliUsageError(`Duplicate option: ${token}`);
    values.set(token, value);
    index += 1;
  }

  return { flags, values };
}

function requireOption(options: ParsedOptions, name: string): string {
  const value = options.values.get(name)?.trim();
  if (!value) throw new CliUsageError(`Option ${name} is required.`);
  return value;
}

function readInteger(
  options: ParsedOptions,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = options.values.get(name);
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new CliUsageError(`Option ${name} must be an integer.`);
  }
  const number = Number(value);
  if (number < minimum || number > maximum) {
    throw new CliUsageError(
      `Option ${name} must be between ${minimum} and ${maximum}.`,
    );
  }
  return number;
}

function setOptional(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  if (value !== undefined) target[key] = value;
}

function responseFormat(options: ParsedOptions): 'json' | 'markdown' {
  return options.flags.has('--json') ? 'json' : 'markdown';
}

function readChoice<T extends string>(
  options: ParsedOptions,
  name: string,
  choices: readonly T[],
): T | undefined {
  const value = options.values.get(name);
  if (value === undefined) return undefined;
  if (!choices.includes(value as T)) {
    throw new CliUsageError(
      `Option ${name} must be one of: ${choices.join(', ')}.`,
    );
  }
  return value as T;
}

function buildSimpleInvocation(
  tokens: string[],
  toolName: string,
): ToolInvocation {
  const options = parseOptions(tokens, [], ['--json']);
  return {
    toolName,
    args: { response_format: responseFormat(options) },
  };
}

function buildAccountInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'settings') {
    return buildSimpleInvocation(tokens, 'duolingo_get_settings');
  }
  if (action === 'daily-xp') {
    return buildSimpleInvocation(tokens, 'duolingo_get_daily_xp_progress');
  }
  if (action === 'profile' || action === 'streak' || action === 'calendar') {
    const options = parseOptions(tokens, ['--username'], ['--json']);
    const args: Record<string, unknown> = {
      response_format: responseFormat(options),
    };
    setOptional(args, 'username', options.values.get('--username'));
    const toolName =
      action === 'profile'
        ? 'duolingo_get_user_info'
        : action === 'streak'
          ? 'duolingo_get_streak_info'
          : 'duolingo_get_calendar';
    return { toolName, args };
  }

  throw new CliUsageError(`Unknown command: account ${action ?? ''}`.trim());
}

function buildCourseInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action !== 'list') {
    throw new CliUsageError(`Unknown command: course ${action ?? ''}`.trim());
  }
  const options = parseOptions(tokens, ['--username'], ['--json']);
  const args: Record<string, unknown> = {
    response_format: responseFormat(options),
  };
  setOptional(args, 'username', options.values.get('--username'));
  return { toolName: 'duolingo_get_courses', args };
}

function buildSocialInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'friends') {
    return buildSimpleInvocation(tokens, 'duolingo_get_friends');
  }
  if (action === 'leaderboard') {
    const options = parseOptions(tokens, ['--unit'], ['--json']);
    const args: Record<string, unknown> = {
      response_format: responseFormat(options),
    };
    setOptional(
      args,
      'unit',
      readChoice(options, '--unit', ['week', 'month'] as const),
    );
    return { toolName: 'duolingo_get_leaderboard', args };
  }
  throw new CliUsageError(`Unknown command: social ${action ?? ''}`.trim());
}

function buildResourceInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'hearts') {
    return buildSimpleInvocation(tokens, 'duolingo_get_health');
  }
  if (action === 'currencies') {
    return buildSimpleInvocation(tokens, 'duolingo_get_currencies');
  }
  throw new CliUsageError(`Unknown command: resource ${action ?? ''}`.trim());
}

function buildShopInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'items') {
    return buildSimpleInvocation(tokens, 'duolingo_get_shop_items');
  }
  throw new CliUsageError(`Unknown command: shop ${action ?? ''}`.trim());
}

function buildGoalInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'streak') {
    return buildSimpleInvocation(tokens, 'duolingo_get_streak_goal');
  }
  throw new CliUsageError(`Unknown command: goal ${action ?? ''}`.trim());
}

function buildLanguageInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'list') {
    const options = parseOptions(
      tokens,
      ['--username'],
      ['--abbreviations', '--json'],
    );
    const args: Record<string, unknown> = {
      abbreviations: options.flags.has('--abbreviations'),
      response_format: responseFormat(options),
    };
    setOptional(args, 'username', options.values.get('--username'));
    return { toolName: 'duolingo_get_languages', args };
  }

  if (action === 'words' || action === 'skills') {
    const options = parseOptions(
      tokens,
      ['--language', '--username'],
      ['--json'],
    );
    const args: Record<string, unknown> = {
      language_abbr: requireOption(options, '--language'),
      response_format: responseFormat(options),
    };
    setOptional(args, 'username', options.values.get('--username'));
    return {
      toolName:
        action === 'words'
          ? 'duolingo_get_known_words'
          : 'duolingo_get_learned_skills',
      args,
    };
  }

  if (action === 'recent-words') {
    const options = parseOptions(
      tokens,
      ['--language', '--limit', '--username'],
      ['--json'],
    );
    const args: Record<string, unknown> = {
      language_abbr: requireOption(options, '--language'),
      response_format: responseFormat(options),
    };
    setOptional(args, 'limit', readInteger(options, '--limit', 1, 100));
    setOptional(args, 'username', options.values.get('--username'));
    return { toolName: 'duolingo_get_recent_words', args };
  }

  throw new CliUsageError(`Unknown command: language ${action ?? ''}`.trim());
}

function buildReviewInvocation(
  action: string | undefined,
  tokens: string[],
): ToolInvocation {
  if (action === 'recent') {
    const options = parseOptions(tokens, ['--language', '--days'], ['--json']);
    const args: Record<string, unknown> = {
      language_abbr: requireOption(options, '--language'),
      response_format: responseFormat(options),
    };
    setOptional(args, 'days', readInteger(options, '--days', 1, 90));
    return { toolName: 'duolingo_get_recent_learning', args };
  }

  if (action === 'sentences') {
    const options = parseOptions(
      tokens,
      ['--language', '--from', '--sessions', '--limit'],
      ['--json'],
    );
    const args: Record<string, unknown> = {
      language_abbr: requireOption(options, '--language'),
      response_format: responseFormat(options),
    };
    setOptional(args, 'from_language', options.values.get('--from'));
    setOptional(args, 'sessions', readInteger(options, '--sessions', 1, 10));
    setOptional(
      args,
      'sentence_limit',
      readInteger(options, '--limit', 1, 100),
    );
    return { toolName: 'duolingo_get_practice_sentences', args };
  }

  if (action === 'material') {
    const options = parseOptions(
      tokens,
      ['--language', '--from', '--topics', '--sessions', '--limit'],
      ['--json'],
    );
    const args: Record<string, unknown> = {
      language_abbr: requireOption(options, '--language'),
      response_format: responseFormat(options),
    };
    setOptional(args, 'from_language', options.values.get('--from'));
    setOptional(args, 'topic_limit', readInteger(options, '--topics', 1, 20));
    setOptional(args, 'sessions', readInteger(options, '--sessions', 1, 10));
    setOptional(
      args,
      'sentence_limit',
      readInteger(options, '--limit', 1, 100),
    );
    return { toolName: 'duolingo_get_review_material', args };
  }

  throw new CliUsageError(`Unknown command: review ${action ?? ''}`.trim());
}

function buildToolInvocation(argv: string[]): ToolInvocation {
  const [group, action, ...tokens] = argv;
  if (group === 'account') return buildAccountInvocation(action, tokens);
  if (group === 'course') return buildCourseInvocation(action, tokens);
  if (group === 'social') return buildSocialInvocation(action, tokens);
  if (group === 'resource') return buildResourceInvocation(action, tokens);
  if (group === 'shop') return buildShopInvocation(action, tokens);
  if (group === 'goal') return buildGoalInvocation(action, tokens);
  if (group === 'language') return buildLanguageInvocation(action, tokens);
  if (group === 'review') return buildReviewInvocation(action, tokens);
  throw new CliUsageError(`Unknown command: ${argv.join(' ')}`);
}

async function requireCredentials(
  dependencies: CliDependencies,
): Promise<ResolvedCredentials> {
  const credentials = await dependencies.credentials.resolve(dependencies.env);
  if (credentials === null) {
    throw new CliUsageError(
      'Duolingo is not authorized. Run: duolingo-cli auth init',
    );
  }
  return credentials;
}

async function handleAuth(
  argv: string[],
  dependencies: CliDependencies,
): Promise<number> {
  const [action, ...tokens] = argv;
  if (action === 'init') {
    if (tokens.length > 0) {
      throw new CliUsageError(
        'auth init does not accept command-line secrets.',
      );
    }
    const credentials = {
      username: (await dependencies.promptText('Duolingo username: ')).trim(),
      jwt: await dependencies.promptSecret('Duolingo JWT: '),
    };
    if (credentials.username.length === 0 || credentials.jwt.length === 0) {
      throw new CliUsageError('Username and JWT are both required.');
    }
    await dependencies.validateCredentials(credentials);
    await dependencies.credentials.save(credentials);
    writeLine(dependencies.stdout, `Authorized as ${credentials.username}.`);
    return 0;
  }

  if (action === 'show') {
    const options = parseOptions(tokens, [], ['--status']);
    const credentials = await dependencies.credentials.resolve(
      dependencies.env,
    );
    if (options.flags.has('--status')) {
      writeLine(
        dependencies.stdout,
        credentials === null ? 'unauthorized' : 'authorized',
      );
      return credentials === null ? 1 : 0;
    }
    if (credentials === null) {
      writeLine(dependencies.stdout, 'Status: unauthorized');
      writeLine(dependencies.stdout, 'Run: duolingo-cli auth init');
      return 1;
    }
    writeLine(dependencies.stdout, 'Status: authorized');
    writeLine(dependencies.stdout, `Username: ${credentials.username}`);
    writeLine(
      dependencies.stdout,
      `Source: ${credentials.source === 'keychain' ? 'system keychain' : 'environment'}`,
    );
    return 0;
  }

  if (action === 'logout') {
    if (tokens.length > 0) {
      throw new CliUsageError('auth logout does not accept options.');
    }
    const deleted = await dependencies.credentials.delete();
    writeLine(
      dependencies.stdout,
      deleted ? 'Stored credentials removed.' : 'No stored credentials found.',
    );
    return 0;
  }

  throw new CliUsageError(`Unknown command: auth ${action ?? ''}`.trim());
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies,
): Promise<number> {
  try {
    if (argv.length === 0 || argv.includes('--help')) {
      writeLine(dependencies.stdout, HELP);
      return 0;
    }
    if (argv.length === 1 && argv[0] === '--version') {
      writeLine(dependencies.stdout, dependencies.version);
      return 0;
    }
    if (argv[0] === 'auth') {
      return await handleAuth(argv.slice(1), dependencies);
    }
    if (argv[0] === 'mcp') {
      if (argv.length > 1)
        throw new CliUsageError('mcp does not accept options.');
      await dependencies.startMcp(await requireCredentials(dependencies));
      return 0;
    }

    const invocation = buildToolInvocation(argv);
    const credentials = await requireCredentials(dependencies);
    const output = await dependencies.runTool(
      invocation.toolName,
      invocation.args,
      credentials,
    );
    writeLine(dependencies.stdout, output);
    return 0;
  } catch (error) {
    writeLine(dependencies.stderr, `Error: ${getErrorMessage(error)}`);
    return 1;
  }
}
