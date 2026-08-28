# duolingo-cli Command Reference

All data commands are read-only. Add `--json` for structured JSON; otherwise
they return Markdown.

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
```

Without `--username`, profile uses the authorized account.

## Languages

```bash
duolingo-cli language list [--username USER] [--abbreviations] [--json]
duolingo-cli language words --language LANG [--username USER] [--json]
duolingo-cli language skills --language LANG [--username USER] [--json]
```

`LANG` is a course abbreviation such as `es`, `fr`, or `de`.

## Review

```bash
duolingo-cli review recent --language LANG [--days 1..90] [--json]
duolingo-cli review sentences --language LANG [--from LANG] [--sessions 1..10] [--limit 1..100] [--json]
duolingo-cli review material --language LANG [--from LANG] [--topics 1..20] [--sessions 1..10] [--limit 1..100] [--json]
```

- `recent` returns recent XP events mapped to learned skills and words. The
  default window is 7 days.
- `sentences` samples and deduplicates current practice challenges. The default
  is 1 session and 20 sentences.
- `material` combines weak learned topics, vocabulary, and current practice
  samples. The defaults are 5 topics, 3 sessions, and 20 sentences.
- `--limit` is a maximum. Sampling and deduplication can return fewer sentences;
  always use the actual returned count.
- Omit `--from` to derive the base language from the matching course. Do not
  assume it is English. If the account has multiple matching courses and the
  intended base language is known, pass `--from` explicitly.
- Recent totals include XP events that can be mapped to skills in the selected
  language. Unmapped or other-course activity is excluded.

Example for recent Spanish activity and ten current review sentences:

```bash
duolingo-cli review recent --language es --days 7 --json
duolingo-cli review material --language es --limit 10 --json
```

Recent activity cannot reconstruct exact historical challenge text. Practice
sentences are current samples and may vary between calls.

## Existing Protocol Compatibility

```bash
duolingo-cli mcp
```

This starts the existing read-only server using the same stored credentials.
It is optional and is not needed for any command in this reference.
