# CLI Guide

[Back to README](../../README.md) · [繁體中文總覽](../../README.zh-TW.md)

`duolingo-cli` is the simplest interface for people, scripts, scheduled jobs,
and automation that does not need an MCP client.

## Install and verify

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli --version
duolingo-cli --help
```

## Configure credentials

Run the interactive setup once:

```bash
duolingo-cli auth init
duolingo-cli auth show
duolingo-cli auth show --status
```

`auth init` validates the account before saving it. The username is stored in an
owner-only configuration file, while the JWT is stored in the operating
system's credential manager. The token is hidden during input and is never
shown by `auth show`.

Credential precedence is:

1. A complete `DUOLINGO_USERNAME` and `DUOLINGO_JWT` environment pair.
2. The username metadata and JWT stored by `auth init`.

Setting only one environment variable is an error. For logout:

```bash
duolingo-cli auth logout
```

Logout removes stored credentials but cannot unset variables owned by the
calling shell.

## Output and exit contracts

- Markdown is the default for direct reading.
- Add `--json` for scripts, filtering, or structured summarization.
- Exit code `0` means success, including a valid empty result.
- Exit code `1` means authorization, validation, network, or API failure.
- Errors are written to stderr; query results are written to stdout.

`duolingo-cli auth show --status` prints exactly `authorized` or `unauthorized`,
which makes it suitable for preflight checks.

## Command reference

### Account

```bash
duolingo-cli account profile [--username USER] [--json]
duolingo-cli account settings [--json]
duolingo-cli account streak [--username USER] [--json]
duolingo-cli account daily-xp [--json]
duolingo-cli account calendar [--username USER] [--json]
```

Without `--username`, profile, streak, and calendar return the authorized
account. Settings and daily XP are authenticated-account queries.

### Courses and social data

```bash
duolingo-cli course list [--username USER] [--json]
duolingo-cli social friends [--json]
duolingo-cli social leaderboard [--unit week|month] [--json]
```

The leaderboard defaults to `week`. Friends and leaderboards use the authorized
account; an empty array is a valid result.

### Resources, shop, and goals

```bash
duolingo-cli resource hearts [--json]
duolingo-cli resource currencies [--json]
duolingo-cli shop items [--json]
duolingo-cli goal streak [--json]
```

All are read-only: they do not refill hearts, spend currency, purchase items,
or change streak goals.

### Languages

```bash
duolingo-cli language list [--username USER] [--abbreviations] [--json]
duolingo-cli language words --language LANG [--username USER] [--json]
duolingo-cli language recent-words --language LANG [--limit 1..100] [--username USER] [--json]
duolingo-cli language skills --language LANG [--username USER] [--json]
```

`LANG` is a course abbreviation such as `es`, `fr`, or `de`.

`language recent-words` defaults to 10 and preserves Duolingo's newest-first
learned-date ranking. Its JSON result includes `rank`, `text`, `translations`,
`audio_url`, and `is_new`. Duolingo does not expose exact per-word timestamps,
so this command cannot filter words learned within an exact date range. The
requested language must be the account's active course.

### Review

```bash
duolingo-cli review recent --language LANG [--days 1..90] [--json]
duolingo-cli review sentences --language LANG [--from LANG] [--sessions 1..10] [--limit 1..100] [--json]
duolingo-cli review material --language LANG [--from LANG] [--topics 1..20] [--sessions 1..10] [--limit 1..100] [--json]
```

| Command            | Default behavior                         | Data source                                                         |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------- |
| `review recent`    | 7 days                                   | Selected-language calendar, mapped to legacy or current-path skills |
| `review sentences` | 1 session, up to 20 sentences            | Current global-practice samples                                     |
| `review material`  | 5 topics, 3 sessions, up to 20 sentences | Weak learned topics plus current practice samples                   |

When a newer course has no legacy skill tree, language and review commands use
the current learning path instead. Known words fall back to the paginated
learned-lexemes result. Activity entries without a skill ID remain in
`total_xp`, `activity_count`, and `activities`, but cannot be mapped to a topic.

`--limit` is a maximum, not a guaranteed count. Sampling, empty sessions, and
deduplication can produce fewer sentences. Omit `--from` to derive the base
language from the matching course; pass it explicitly when the account has
multiple matching courses and the intended base language is known.

### MCP compatibility

```bash
duolingo-cli mcp
```

This starts the existing stdio MCP server with the same resolved credentials.
No CLI query requires MCP mode.

## Usage scenarios

### Weekly Spanish review

```bash
duolingo-cli review recent --language es --days 7 --json
duolingo-cli review material --language es --topics 5 --sessions 3 --limit 10 --json
```

The first command reports mapped recent activity. The second creates a review
bundle; it does not reconstruct the exact lessons completed during the week.

### Export known vocabulary

```bash
duolingo-cli language words --language fr --json > french-words.json
```

The redirected file contains the command result, never the stored JWT.

### List the latest ten learned words

```bash
duolingo-cli language recent-words --language ja --limit 10 --json
```

The words are ordered newest first by Duolingo. Treat the ranking as recent
learning order, not as proof that every word was learned during a particular
calendar window.

### Inspect another public profile

```bash
duolingo-cli account profile --username another_user --json
duolingo-cli language list --username another_user --abbreviations --json
```

The unofficial API can still require valid authorization for public-profile
queries.

## Troubleshooting

| Symptom                         | Action                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| `unauthorized`                  | Run `duolingo-cli auth init` in an interactive terminal                |
| Authentication expired          | Obtain a fresh token and run `auth init` again                         |
| Partial environment credentials | Set both variables or unset both                                       |
| Language not found              | Run `language list --abbreviations --json` and use a returned code     |
| Fewer sentences than requested  | Report the actual count; optionally increase `--sessions` within 1..10 |
| Empty practice session          | Retry later; do not invent content                                     |
| CAPTCHA or API rejection        | Stop and retry later rather than looping aggressively                  |

Do not pass JWT values as command-line arguments or paste them into chat. The
CLI deliberately offers only interactive secret input and environment-variable
compatibility.
