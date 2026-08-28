# Agent Guidelines — duolingo

TypeScript MCP server that wraps the unofficial Duolingo REST API. Uses the
MCP SDK with stdio transport, Zod for input validation, and Axios for HTTP.

---

## Project Overview

- **Entry points:** `src/cli.ts` (CLI), `src/server.ts` (MCP binary),
  `src/index.ts` (library)
- **Auth:** CLI system-keychain credentials or a complete
  `DUOLINGO_USERNAME` + `DUOLINGO_JWT` environment pair
- **Design:** Read-first; all tools are read-only (no writes to Duolingo)
- **Tool naming:** `duolingo_<action>_<resource>` pattern (snake_case)
- **Server name:** `duolingo_mcp`

---

## Using the CLI and Skill

The agent-neutral `duolingo-learn` Skill should use `duolingo-cli` as its
stable query interface. It does not require an MCP client or product-specific
Agent configuration.

Install or upgrade both components:

```bash
npm install -g @yummysource/duolingo-cli@latest
npx skills add yummysource/duolingo -y -g
```

Authorization is interactive and only needs to be completed once:

```bash
duolingo-cli auth init
duolingo-cli auth show
duolingo-cli auth show --status
```

Before an automated query, run `duolingo-cli --version` and
`duolingo-cli auth show --status`. If authorization is missing or expired, ask
the user to run `duolingo-cli auth init` in their own terminal. Never ask for,
print, log, or commit a JWT. Do not pass a JWT as a command argument.

Use `--json` when an Agent will filter, combine, or summarize results. Empty
arrays are valid query results; exit code `0` means success and exit code `1`
means authorization, validation, network, or API failure.

### Read-only query commands

```bash
# Account and activity
duolingo-cli account profile [--username USER] [--json]
duolingo-cli account settings [--json]
duolingo-cli account streak [--username USER] [--json]
duolingo-cli account daily-xp [--json]
duolingo-cli account calendar [--username USER] [--json]

# Courses and social data
duolingo-cli course list [--username USER] [--json]
duolingo-cli social friends [--json]
duolingo-cli social leaderboard [--unit week|month] [--json]

# Account resources, shop, and goals
duolingo-cli resource hearts [--json]
duolingo-cli resource currencies [--json]
duolingo-cli shop items [--json]
duolingo-cli goal streak [--json]

# Language learning
duolingo-cli language list [--username USER] [--abbreviations] [--json]
duolingo-cli language words --language LANG [--username USER] [--json]
duolingo-cli language recent-words --language LANG [--limit 1..100] [--username USER] [--json]
duolingo-cli language export --language LANG [--format json|csv|tsv|anki] [--limit 1..1000]
duolingo-cli language skills --language LANG [--username USER] [--json]

# Numbered topics
duolingo-cli topic words --language LANG --topic N [--username USER] [--json]
duolingo-cli topic sentences --language LANG --topic N [--username USER] [--sessions 1..10] [--limit 1..100] [--json]

# Review
duolingo-cli review recent --language LANG [--days 1..90] [--json]
duolingo-cli review sentences --language LANG [--from LANG] [--sessions 1..10] [--limit 1..100] [--json]
duolingo-cli review material --language LANG [--from LANG] [--topics 1..20] [--sessions 1..10] [--limit 1..100] [--json]

# Diagnostics and opt-in local history
duolingo-cli doctor [--language LANG] [--json]
duolingo-cli canary --language LANG [--json]
duolingo-cli snapshot init|capture|status|diff|disable --language LANG [options]
```

Review sentences are current randomized practice samples, not exact historical
lesson text. Requested sentence limits are maxima and deduplication may return
fewer results. Recent words preserve Duolingo's learned-date ranking but do not
include exact learned timestamps. Every exposed CLI and Skill operation is read-only: it must not
submit answers, change progress, spend currency, buy items, refill hearts, or
modify goals.

The maintained command reference is
`skills/duolingo-learn/references/cli-commands.md`. Update the CLI parser,
tests, Skill reference, user documentation, and this guideline together when
the command surface changes.

---

## Build, Lint & Test Commands

This project uses **mise** (`mise.toml`) to manage tasks and the Node.js
toolchain. Always prefer `mise run <task>` over invoking npm scripts directly.
Mise tasks handle dependencies automatically (e.g. `build` runs `install` first).

```bash
# Install dependencies
mise run install

# Build (compiles src/ → dist/)
mise run build

# Type-check without emitting
mise run typecheck

# Lint
mise run lint
mise run "lint:fix"

# Format
mise run format        # write changes
mise run "format:check"  # check only

# Tests (Vitest)
mise run test                # run all tests once
mise run "test:watch"        # watch mode
mise run "test:coverage"     # with v8 coverage

# Run a single test file (invoke vitest directly)
npx vitest run tests/tools/account.test.ts

# Run tests matching a name pattern
npx vitest run -t "getUserData"

# Run all quality checks at once (typecheck + lint + format:check + test)
mise run check

# Full CI pipeline (install → build → check)
mise run ci

# Start MCP server in dev mode (no build required)
mise run dev

# Inspect MCP tools via CLI or browser UI (reads credentials from .env)
mise run inspect
mise run "inspect:ui"
```

Test files live under `tests/` and mirror `src/` layout. The framework is
**Vitest** (`vitest.config.ts`); globals (`describe`, `it`, `expect`, `vi`)
are enabled automatically — no explicit imports needed.

---

## TypeScript Configuration

- **Target:** ES2022, **module:** ESNext, **moduleResolution:** bundler
- **Strict mode:** fully enabled, including:
  - `noUncheckedIndexedAccess` — array/object accesses may return `undefined`
  - `noImplicitOverride` — `override` keyword required when overriding
- **ESM:** the package uses `"type": "module"`; all internal imports must use
  `.js` extensions (e.g., `import { foo } from './bar.js'`)
- `src/` is compiled; `tests/` is excluded from compilation but included in
  `tsconfig.lint.json` for linting

---

## Code Style

Enforced by Prettier + ESLint. Run `mise run "lint:fix" && mise run format` to
auto-fix most issues.

### Formatting (Prettier)

- Single quotes, semicolons, trailing commas everywhere
- 2-space indent, 80-column print width, LF line endings, no tabs
- `arrowParens: 'always'`, `bracketSpacing: true`

### Imports

- Use `import type { ... }` or inline `type` keyword for type-only imports
  (`consistent-type-imports` rule, `fixStyle: inline-type-imports`)
- Import paths must end with `.js` (ESM resolution)
- Group: external packages first, then internal modules

### Naming

- **MCP tools:** `duolingo_<verb>_<noun>` snake_case (e.g., `duolingo_get_user_info`)
- **Classes:** PascalCase (e.g., `DuolingoClient`, `DuolingoAuthError`)
- **Functions/variables:** camelCase
- **Unused parameters/variables:** prefix with `_` to suppress the lint rule

### Types

- `no-explicit-any` is an error in `src/`; use proper types or generics
- All `no-unsafe-*` rules (`assignment`, `call`, `member-access`, etc.) are
  errors — avoid unsafe casts and untyped boundaries
- Prefer `nullish coalescing` (`??`) and optional chaining (`?.`) over
  explicit null checks (`prefer-nullish-coalescing`, `prefer-optional-chain`)
- `switch` statements on union types must be exhaustive
  (`switch-exhaustiveness-check`)
- Template literals must not embed `any` or nullish values
  (`restrict-template-expressions` — numbers and booleans are allowed)

### Error Handling

Custom error hierarchy (all in `src/client/errors.ts`):

```
DuolingoClientError (base)
  ├── DuolingoAuthError
  ├── DuolingoNotFoundError
  ├── DuolingoCaptchaError
  └── DuolingoLanguageNotFoundError
```

- Each subclass sets `this.name` explicitly for reliable `instanceof` checks
- MCP tool handlers always wrap logic in `try/catch` and return errors as
  `{ content: [{ type: 'text', text: handleError(err) }] }` — never throw
  out of a tool handler
- `handleError(err: unknown)` in `src/tools/helpers.ts` type-narrows to each
  custom error and returns a user-facing `"Error: ..."` string

### Async

- All Duolingo API calls are async; floating promises are an error
  (`no-floating-promises`)
- Functions must not declare `async` unless they actually `await` something
  (`require-await`)

---

## MCP Tool Structure

Each tool is registered via `server.registerTool(name, config, handler)`:

```ts
server.registerTool(
  'duolingo_get_foo',
  {
    title: 'Get Foo',
    description: 'Returns the foo for the given user.',
    inputSchema: {
      username: UsernameFieldSchema,
      response_format: ResponseFormatSchema,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ username, response_format }) => {
    try {
      const client = getClient();
      const data = await client.getFoo(username);
      if (response_format === 'json') {
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }
      return { content: [{ type: 'text', text: formatMarkdown(data) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: handleError(err) }] };
    }
  },
);
```

**Required for every tool:**

- JSDoc comment on the tool registration (description field)
- Zod input validation via `inputSchema`
- All four MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`)
- `try/catch` with `handleError` in the handler

**Required for tools that return structured data:**

- Dual `response_format` support: `'markdown'` (default) and `'json'`
- Use `ResponseFormatSchema` in `inputSchema`

Simple scalar tools that return a plain string (e.g. `duolingo_get_language_from_abbr`,
`duolingo_get_abbreviation_of`, `duolingo_get_audio_url`) do not need `response_format`.

Shared schemas (`src/tools/helpers.ts`):

- `ResponseFormatSchema` — `z.enum(['markdown', 'json']).default('markdown')`
- `UsernameFieldSchema` — `z.string().optional()`

---

## Testing Conventions

- **Framework:** Vitest with node environment; globals enabled
- **Mocking:** use `vi.spyOn` to mock `getClient()` in tool tests; inject a
  mock `http` object directly into `DuolingoClient`'s private field for
  client unit tests
- **Tool tests:** call tools via the shared `callTool(server, name, args)`
  helper in `tests/helpers.ts`
- **MCP protocol tests:** `tests/server/mcp.test.ts` spins up a real
  `McpServer` with `InMemoryTransport` — add new tools to the expected list
- **Package surface tests:** `tests/package/exports.test.ts` imports only from
  `src/index.ts`; add new public exports there
- **Integration tests:** `tests/integration/` hit the live Duolingo API and
  require env vars — do not run these in CI without credentials

---

## Quality Gates

Before merging, all of the following must pass (`mise run check` runs them all):

```bash
mise run typecheck
mise run lint
mise run "format:check"
mise run test
```

CI runs these automatically via `.github/workflows/ci.yml`.
