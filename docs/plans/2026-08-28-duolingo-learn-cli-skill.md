# Duolingo Learn CLI and Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a publish-ready `duolingo-cli` and an agent-neutral
`duolingo-learn` Skill that expose the repository's read-only Duolingo account,
language, and review capabilities without requiring MCP configuration.

**Architecture:** Keep the existing MCP tools as the single behavior layer. A
shared server factory registers every tool, while the CLI calls those tools over
an in-memory MCP transport. Authentication resolves complete environment
credentials first and otherwise reads the JWT from the operating-system
keychain; only the non-secret username is stored in the CLI config directory.
The Skill contains portable Markdown instructions and a CLI command reference,
with no `agents/` directory or Agent-specific runtime dependency.

**Tech Stack:** TypeScript, Node.js, MCP SDK, Zod, Vitest,
`@napi-rs/keyring`, npm packaging.

### Task 1: Shared MCP server factory

**Files:**

- Create: `src/mcp.ts`
- Modify: `src/server.ts`
- Create: `tests/server/factory.test.ts`

1. Write a failing test that creates the server through
   `createDuolingoMcpServer()` and discovers the three Review tools.
2. Run `npx vitest run tests/server/factory.test.ts` and confirm the missing
   factory failure.
3. Implement the factory by registering account, language, review, and shop
   tools. Make `src/server.ts` use the factory with stdio transport.
4. Re-run the focused test and existing MCP discovery test.

### Task 2: Credential resolution and system keychain storage

**Files:**

- Create: `src/cli/credentials.ts`
- Create: `tests/cli/credentials.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

1. Write failing tests for environment precedence, rejecting partial
   environment credentials, storing only the username in config, reading the
   JWT through an injected vault, and deleting both records on logout.
2. Run `npx vitest run tests/cli/credentials.test.ts` and confirm the module is
   missing.
3. Implement a `CredentialStore` with injected filesystem/config location and
   vault operations. The production vault uses the OS credential store under
   service `duolingo-learn`; config files and directories use owner-only
   permissions.
4. Re-run the focused tests. Confirm no JWT appears in config fixtures or test
   output.

### Task 3: CLI parser, auth flow, and MCP invocation

**Files:**

- Create: `src/cli/program.ts`
- Create: `src/cli/tool-runner.ts`
- Create: `src/cli/prompts.ts`
- Create: `src/cli.ts`
- Create: `tests/cli/program.test.ts`
- Create: `tests/cli/tool-runner.test.ts`

1. Write failing tests for `--help`, `--version`, unknown-command errors,
   `auth init/show/logout`, exact `auth show --status` output, JSON routing,
   numeric validation, and missing-auth guidance.
2. Write failing tool-runner tests proving it calls registered tools through an
   in-memory transport and treats tool text beginning with `Error:` as a CLI
   failure.
3. Implement injectable CLI dependencies so tests never touch the live API or
   system keychain. Validate credentials with `DuolingoClient.getUserData()`
   before saving and hide JWT input.
4. Map commands to tools:
   - `account profile` -> `duolingo_get_user_info`
   - `language list` -> `duolingo_get_languages`
   - `language words` -> `duolingo_get_known_words`
   - `language skills` -> `duolingo_get_learned_skills`
   - `review recent` -> `duolingo_get_recent_learning`
   - `review sentences` -> `duolingo_get_practice_sentences`
   - `review material` -> `duolingo_get_review_material`
5. Add `mcp` mode, which resolves stored credentials before starting the stdio
   server. Re-run focused and full tests.

### Task 4: Agent-neutral Skill

**Files:**

- Create: `skills/duolingo-learn/SKILL.md`
- Create: `skills/duolingo-learn/references/cli-commands.md`

1. Record the baseline evaluation: without a Skill, the evaluator correctly
   avoids requesting JWT but must probe unknown commands, may fall back to a
   temporary environment secret, and cannot know the historical-sentence
   limitation.
2. Write a concise Skill with only `name` and `description` frontmatter. Require
   `duolingo-cli auth show --status`, interactive `auth init` when needed,
   `--json` for Agent processing, and explicit disclosure that current practice
   samples are not exact historical lessons.
3. Put the maintained command grammar and argument mappings in
   `references/cli-commands.md` and link it from `SKILL.md`.
4. Confirm there is no `agents/openai.yaml`, Agent product name, MCP dependency,
   or instruction to paste JWT into chat.
5. Validate with the bundled `quick_validate.py` and re-run a realistic usage
   evaluation with the Skill present.

### Task 5: Package and documentation surface

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `tests/package/exports.test.ts`

1. Add failing package-surface assertions for the `duolingo-cli` bin, retained
   `duolingo-mcp` bin, and inclusion of the Skill in the packed package.
2. Change the package identity to `@yummysource/duolingo-cli`, retain the
   existing library export, add both binaries, and include `skills/**` in
   package files.
3. Document CLI installation, Skill installation, authentication, commands,
   MCP compatibility, read-only behavior, and the unofficial API caveat.
4. Build and run both binary help/version smoke tests from `dist/`.

### Task 6: Verification and delivery

1. Run `npm run format`, `npm run typecheck`, `npm run lint`, `npm test`, and
   `npm run build`.
2. Run Skill validation and `npm pack --dry-run`; inspect the file list for
   credentials, `.env`, JWT values, and accidental local files.
3. Review the diff for read-only MCP annotations and secret safety.
4. Commit the feature, push `feat/duolingo-learn-cli-skill`, and create a
   stacked pull request targeting `feat/review-content-mcp` while PR #1 remains
   open. Do not publish the npm package.
