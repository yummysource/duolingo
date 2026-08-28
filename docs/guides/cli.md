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
```

Without `--username`, the command returns the authorized account.

### Languages

```bash
duolingo-cli language list [--username USER] [--abbreviations] [--json]
duolingo-cli language words --language LANG [--username USER] [--json]
duolingo-cli language skills --language LANG [--username USER] [--json]
```

`LANG` is a course abbreviation such as `es`, `fr`, or `de`.

### Review

```bash
duolingo-cli review recent --language LANG [--days 1..90] [--json]
duolingo-cli review sentences --language LANG [--from LANG] [--sessions 1..10] [--limit 1..100] [--json]
duolingo-cli review material --language LANG [--from LANG] [--topics 1..20] [--sessions 1..10] [--limit 1..100] [--json]
```

| Command            | Default behavior                         | Data source                                                          |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| `review recent`    | 7 days                                   | Selected-language calendar, with legacy skill mapping when available |
| `review sentences` | 1 session, up to 20 sentences            | Current global-practice samples                                      |
| `review material`  | 5 topics, 3 sessions, up to 20 sentences | Weak learned topics plus current practice samples                    |

Newer learning-path courses may return activity and XP without legacy skill
IDs. In that case `total_xp`, `activity_count`, and `activities` remain useful,
while `skills` and `words` may be empty.

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
