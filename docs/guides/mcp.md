# MCP Guide

[Back to README](../../README.md) · [繁體中文總覽](../../README.zh-TW.md)

Use MCP mode when a compatible client should discover and call Duolingo tools
through stdio. The existing MCP interface remains available alongside the API,
CLI, and Skill.

## Start the server

With a global installation and credentials saved by the CLI:

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli auth init
duolingo-cli mcp
```

Without a global installation:

```bash
npx --package @yummysource/duolingo-cli duolingo-cli mcp
```

The legacy binary remains available for environment-managed deployments:

```bash
DUOLINGO_USERNAME=your_username \
DUOLINGO_JWT=your_jwt_token \
duolingo-mcp
```

Do not place real JWT values in committed MCP configuration files. Prefer
`duolingo-cli auth init` where the client can run the installed CLI.

## Generic stdio configuration

After running `duolingo-cli auth init`, a client configuration only needs the
command and argument:

```json
{
  "mcpServers": {
    "duolingo": {
      "command": "duolingo-cli",
      "args": ["mcp"]
    }
  }
}
```

For containers or secret-managed CI, inject both environment variables through
the platform's secret facility instead of hard-coding them in JSON.

## Server contract

- Server name: `duolingo_mcp`
- Transport: stdio
- Input validation: Zod schemas exposed through MCP tool definitions
- Errors: text content beginning with `Error:` rather than uncaught handler
  exceptions
- Output: Markdown by default and JSON for structured-data tools when
  `response_format` is `json`
- Safety: every tool is annotated as read-only and non-destructive

## Tool groups

### Account

Profile, settings, streak, daily XP, languages, courses, friends, calendar,
leaderboard, shop catalogue, hearts, currencies, and streak goals.

### Language

Language details and progress, learned and unknown topics, mastered and
reviewable topics, known words, learned skills, TTS voices, and audio URLs.

### Review

| Tool                              | Important inputs                                                                                          | Result                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `duolingo_get_recent_learning`    | `language_abbr`, `days`, `response_format`                                                                | Recent mapped XP, skills, words, and activity records       |
| `duolingo_get_practice_sentences` | `language_abbr`, optional `from_language`, `sessions`, `sentence_limit`, `response_format`                | Deduplicated current prompts, answers, tokens, and TTS URLs |
| `duolingo_get_review_material`    | `language_abbr`, optional `from_language`, `topic_limit`, `sessions`, `sentence_limit`, `response_format` | Weak topics, vocabulary, and current practice samples       |

`from_language` is derived from the matching course when omitted. Sentence
limits are maxima, and current practice samples are not exact historical lesson
content.

### Utilities

Language-name and abbreviation conversion for languages present on the queried
account.

The complete tool list is maintained in the root [README](../../README.md#available-tools).

## Inspect locally

Build the repository and list tools through the MCP Inspector:

```bash
npm install
npm run build
npx @modelcontextprotocol/inspector --cli --method tools/list \
  node dist/server.js
```

When using stored CLI credentials, inspect `duolingo-cli mcp` as the server
command. When using environment credentials, provide them through the
inspector's environment options without printing them in shared logs.

## Data and safety limits

- Duolingo exposes no supported endpoint for reconstructing exact completed
  lesson sentences from XP history.
- Global-practice sessions are current, randomized, and occasionally empty.
- The project uses unofficial endpoints that can change without notice.
- The server does not answer challenges, finish sessions, purchase items,
  modify settings, or write progress.
- Treat authentication failures and CAPTCHA responses as stopping conditions;
  do not retry aggressively.
