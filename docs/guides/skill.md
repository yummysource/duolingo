# Skill Guide

[Back to README](../../README.md) · [繁體中文總覽](../../README.zh-TW.md)

The `duolingo-learn` Skill packages stable Duolingo workflows as portable
instructions. It lets different automation agents use the same CLI contract
without configuring MCP for every client.

## Architecture

```text
Natural-language request
        ↓
skills/duolingo-learn/SKILL.md
        ↓
duolingo-cli
        ↓
shared read-only MCP tool handlers
        ↓
unofficial Duolingo API
```

The Skill depends on `duolingo-cli`, not on a specific agent runtime. It has no
`agents/openai.yaml`, product-specific metadata, embedded credentials, or MCP
configuration.

## Install

Install and authorize the CLI first:

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli auth init
```

Then install the Skill from this repository:

```bash
npx skills add yummysource/duolingo -y -g
```

The installed source is intentionally small:

```text
skills/duolingo-learn/
├── SKILL.md
└── references/
    └── cli-commands.md
```

`SKILL.md` defines routing, security, and data boundaries. The reference holds
the maintained command grammar and defaults.

## What the Skill handles

- Account profile and learning-language inspection.
- Account settings, streak, daily XP, and recent calendar activity.
- Course enrolments, friends, and weekly or monthly leaderboards.
- Hearts, currency balances, shop items, and streak goals.
- Known vocabulary, latest learned words, and learned skills.
- Vocabulary and current practice samples for a numbered learning-path topic.
- Native JSON, CSV, TSV, and Anki-friendly vocabulary export.
- Recent XP activity mapped to skills and words.
- Current practice-sentence sampling.
- Review bundles based on weak topics, vocabulary, and practice samples.
- Authorization preflight and safe recovery instructions.
- Credential/schema diagnostics and read-only Live Canary routing.
- Explicitly approved local vocabulary snapshots and diffs.

## Example requests

- “Show the languages on my Duolingo account.”
- “How many hearts and gems do I have?”
- “Show my streak, daily XP, and next streak goal.”
- “List my courses and this week's friend leaderboard.”
- “Export my known French words as JSON.”
- “Export my Japanese vocabulary as an Anki TSV.”
- “List the latest 10 Japanese words I learned.”
- “Summarize my Spanish activity from the last 14 days.”
- “Prepare up to 10 Spanish review sentences based on my weak topics.”
- “Show the words and five current practice examples for Japanese topic 53.”
- “Show my profile and then build this week's review bundle.”
- “Enable 90-capture Japanese vocabulary history, then capture today.”

For structured tasks, the Skill selects CLI commands with `--json`, combines
the results, and reports actual counts rather than assuming requested limits
were reached.

## Authorization workflow

The Skill checks:

```bash
duolingo-cli --version
duolingo-cli auth show --status
```

If authorization is missing or expired, it stops and asks the user to run this
locally:

```bash
duolingo-cli auth init
```

It must never request that a JWT be pasted into a conversation, print the
token, place it in a repository, or pass it as a process argument.

## Review-data boundaries

The Skill deliberately explains these distinctions:

- Latest learned words preserve Duolingo's learned-date ranking. The API does
  not expose exact per-word timestamps, so they cannot be filtered reliably as
  “words learned in the last N days.”
- Recent-learning data maps XP records to selected-language skills and words.
  It cannot reconstruct the exact prompts, answers, or sentences from past
  lessons.
- Practice sentences are current global-practice samples. They can vary between
  calls and are not a replay of completed lessons.
- Numbered-topic samples use the one-based order returned by `language skills`.
  They are generated current challenges, not a complete topic corpus or lesson
  history, and no answers or session completions are submitted.
- Sentence limits are maxima. Empty sessions and deduplication can return fewer
  items.
- Unmapped XP events and events belonging to another course are excluded from
  selected-language recent totals.
- All operations are read-only and do not submit answers or change progress.

## Portability checklist

When adapting or redistributing the Skill, preserve these invariants:

1. Keep the public name `duolingo-learn`; reserve `duolingo` to avoid a future
   official-name collision.
2. Keep command behavior in the CLI rather than duplicating API logic in the
   Skill.
3. Keep the Skill independent of vendor-specific metadata.
4. Route detailed command syntax to `references/cli-commands.md`.
5. Never embed credentials or direct users to reveal tokens in conversation.
6. Preserve the exact-history and current-sampling limitations.
7. Require explicit approval before enabling snapshots or deleting their data.

## Updating

Before relying on newly documented commands, check `duolingo-cli --help`. If an
installed version lacks a command, upgrade `@yummysource/duolingo-cli` rather
than guessing an older grammar, then reinstall or refresh the Skill using the
same repository source.
