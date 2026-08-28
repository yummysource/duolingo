# duolingo-cli Command Reference

All remote Duolingo operations are read-only. Snapshot commands manage only
opt-in local files. Add `--json` for structured JSON; otherwise commands return
Markdown.

## Setup and Authorization

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli --version
duolingo-cli auth init
duolingo-cli auth show
duolingo-cli auth show --status
duolingo-cli auth logout
```

`auth init` prompts for the username and hides JWT input. `auth show --status`
prints exactly `authorized` or `unauthorized`; an unauthorized state uses exit
code 1. `auth show` never displays the JWT. `auth logout` removes only stored
credentials and cannot unset credentials already supplied by the environment.

## Account

```bash
duolingo-cli account profile [--username USER] [--json]
duolingo-cli account settings [--json]
duolingo-cli account streak [--username USER] [--json]
duolingo-cli account daily-xp [--json]
duolingo-cli account calendar [--username USER] [--json]
```

Without `--username`, profile, streak, and calendar use the authorized account.
Settings and daily XP are available only for the authorized account.

## Courses and Social

```bash
duolingo-cli course list [--username USER] [--json]
duolingo-cli social friends [--json]
duolingo-cli social leaderboard [--unit week|month] [--json]
```

Course lists can include language, Math, Chess, and Music courses. Friends and
leaderboards are scoped to the authorized account. An empty social result is a
valid result, not an authorization failure.

## Resources, Shop, and Goals

```bash
duolingo-cli resource hearts [--json]
duolingo-cli resource currencies [--json]
duolingo-cli shop items [--json]
duolingo-cli goal streak [--json]
```

These commands inspect current hearts, gem/lingot balances, the shop catalogue,
and streak-goal checkpoints. They never spend currency, buy items, refill
hearts, or modify a goal.

## Languages

```bash
duolingo-cli language list [--username USER] [--abbreviations] [--json]
duolingo-cli language words --language LANG [--username USER] [--json]
duolingo-cli language recent-words --language LANG [--limit 1..100] [--username USER] [--json]
duolingo-cli language export --language LANG [--username USER] [--format json|csv|tsv|anki] [--limit 1..1000]
duolingo-cli language skills --language LANG [--username USER] [--json]
```

`LANG` is a course abbreviation such as `es`, `fr`, or `de`.
`language recent-words` defaults to 10 results and preserves Duolingo's
newest-first learned-date ranking. It requires the requested language to be the
active course. Exact per-word timestamps are unavailable, so do not describe
the result as words learned within an exact date range.

`language export` writes to stdout. Redirect it to a user-selected path. CSV
and TSV preserve source fields; `anki` is a tab-separated import table with
Front, Back, Audio URL, Tags, and Stable ID columns.

## Diagnostics and Local History

```bash
duolingo-cli doctor [--language LANG] [--json]
duolingo-cli canary --language LANG [--json]
duolingo-cli snapshot init --language LANG [--retention 2..365] [--json]
duolingo-cli snapshot capture --language LANG [--json]
duolingo-cli snapshot status --language LANG [--json]
duolingo-cli snapshot diff --language LANG [--json]
duolingo-cli snapshot disable --language LANG [--delete-data] [--json]
```

Use `doctor` to distinguish authentication, CAPTCHA, rate limit, schema drift,
and upstream failures. A Canary compares observable state before and after its
read probes; do not run it while the user is completing a lesson. Snapshots
must be initialized explicitly, begin history at opt-in, and retain 90 captures
by default. Never add `--delete-data` unless the user explicitly asks to erase
the saved snapshots. `doctor` and snapshot operations other than `capture` can
run without Duolingo credentials.

## Review

```bash
duolingo-cli review recent --language LANG [--days 1..90] [--json]
duolingo-cli review sentences --language LANG [--from LANG] [--sessions 1..10] [--limit 1..100] [--json]
duolingo-cli review material --language LANG [--from LANG] [--topics 1..20] [--sessions 1..10] [--limit 1..100] [--json]
```

- `recent` returns selected-language calendar XP and activities, mapping skill
  details from the legacy tree or the current learning path. The default window
  is 7 days.
- `sentences` samples and deduplicates current practice challenges. The default
  is 1 session and 20 sentences.
- `material` combines weak learned topics, vocabulary, and current practice
  samples. The defaults are 5 topics, 3 sessions, and 20 sentences.
- `--limit` is a maximum. Sampling and deduplication can return fewer sentences;
  always use the actual returned count.
- Omit `--from` to derive the base language from the matching course. Do not
  assume it is English. If the account has multiple matching courses and the
  intended base language is known, pass `--from` explicitly.
- Some learning-path activity records omit skill IDs. Keep their XP and
  activity records even when they cannot be mapped to a topic. Language words
  use learned lexemes when legacy skill words are unavailable.

Example for recent Spanish activity and ten current review sentences:

```bash
duolingo-cli review recent --language es --days 7 --json
duolingo-cli review material --language es --limit 10 --json
```

Example for the latest ten Japanese words:

```bash
duolingo-cli language recent-words --language ja --limit 10 --json
```

Recent activity cannot reconstruct exact historical challenge text. Practice
sentences are current samples and may vary between calls.

## Existing Protocol Compatibility

```bash
duolingo-cli mcp
```

This starts the existing read-only server using the same stored credentials.
It is optional and is not needed for any command in this reference.
