---
name: duolingo-learn
description: Use when users want to inspect their Duolingo account, languages, vocabulary, recent learning activity, practice sentences, or review material through duolingo-cli.
---

# Duolingo Learn

Use `duolingo-cli` for read-only Duolingo learning queries. It provides stable,
structured commands without requiring separate protocol configuration.

## Before a Query

1. Confirm the CLI exists with `duolingo-cli --version`. If it is missing, tell
   the user to install `@yummysource/duolingo-cli` globally with npm.
2. Run `duolingo-cli auth show --status`.
3. If it prints `unauthorized`, stop and ask the user to run
   `duolingo-cli auth init` in their own interactive terminal. Resume only after
   authorization succeeds.

If the installed CLI does not expose a referenced command in
`duolingo-cli --help`, ask the user to upgrade the package instead of guessing
an older command grammar.

Never ask the user to paste a JWT into chat, pass a JWT as a command argument,
print it, or put it in a file. Authorization stores the token in the operating
system's credential manager. Complete `DUOLINGO_USERNAME` and `DUOLINGO_JWT`
environment variables may override stored credentials when the user already
manages them outside this workflow.

## Run Queries

Read [references/cli-commands.md](references/cli-commands.md) when choosing a
command or parameter. Prefer `--json` when the result will be filtered,
combined, or summarized programmatically. Use the default Markdown output when
the command result can be shown directly.

For review requests, distinguish the two data sources:

- `review recent` returns language-specific calendar XP and activities. The CLI
  maps skill IDs through either the legacy tree or the current learning path.
  Preserve records that have no skill ID; Duolingo does not provide exact
  historical lesson sentences through these records.
- `review sentences` and the sentence portion of `review material` are current
  global-practice samples, not a replay of lessons the user completed.

Sentence `--limit` values are maxima, not guaranteed counts. Sampling,
deduplication, or empty sessions can return fewer sentences; report the actual
count instead of claiming the requested count was reached.

State that limitation whenever a request asks for exact past lesson content.
Do not claim that a query changes lessons, progress, streaks, answers, or the
account: all exposed commands are read-only.

## Handle Failures

- Exit code `0` means success; preserve valid empty results.
- Exit code `1` means authorization, validation, network, or API failure. Report
  the concise error and do not invent data.
- If authorization expired, direct the user back to interactive
  `duolingo-cli auth init`. Do not request the token itself.
