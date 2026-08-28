---
name: duolingo-learn
description: Use when users want to inspect Duolingo learning data, export vocabulary for CSV or Anki, diagnose CLI authentication or API failures, run a read-only state canary, or manage opt-in local vocabulary history through duolingo-cli.
metadata:
  cli-package: '@yummysource/duolingo-cli'
  minimum-cli-version: '1.1.0'
---

# Duolingo Learn

Use `duolingo-cli` for read-only Duolingo learning queries. It provides stable,
structured commands without requiring separate protocol configuration.
It requires Node.js 18 or newer and CLI version 1.1.0 or newer.

## Before a Query

1. Confirm `duolingo-cli --version` is 1.1.0 or newer. If it is missing or
   older, stop and ask the user to run
   `npm install -g @yummysource/duolingo-cli@latest`.
2. Determine whether the operation contacts Duolingo. `doctor` and local
   `snapshot init`, `status`, `diff`, and `disable` can run without credentials;
   do not block those commands on an authorization preflight.
3. Before any remote data command, Live Canary, or `snapshot capture`, run
   `duolingo-cli auth show --status`.
4. If it prints `unauthorized`, stop and ask the user to run
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

- `language recent-words` returns the latest learned lexemes in Duolingo's
  newest-first learned-date ranking. Use it for requests such as “list my
  latest 10 Japanese words.” Preserve the returned order. Explain that exact
  learned timestamps are unavailable, so this is not an exact “last N days”
  vocabulary filter. For Japanese (`--language ja`), always include standard
  Hepburn romaji for every word in the user-facing result, even when the user
  does not explicitly request it. Also show the kana reading for words written
  with kanji, and use macrons for long vowels (for example, `カード` → `kādo`).
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
account: every remote operation is read-only. Snapshot commands can write or
delete only local files after the required explicit approval.

Use `language export` when the user asks for CSV, TSV, or Anki data; do not
reconstruct those formats manually. For historical vocabulary changes, check
`snapshot status` first. If snapshots are disabled, explain that history starts
only after the user explicitly approves `snapshot init`. Never enable snapshot
storage or use `snapshot disable --delete-data` without explicit approval. Use
`doctor` for authentication or upstream-shape failures.

## Handle Failures

- Exit code `0` means success; preserve valid empty results.
- Exit code `1` means authorization, validation, network, or API failure. Report
  the concise error and do not invent data.
- If authorization expired, direct the user back to interactive
  `duolingo-cli auth init`. Do not request the token itself.
