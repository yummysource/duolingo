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
- Known vocabulary and learned skills.
- Recent XP activity mapped to skills and words.
- Current practice-sentence sampling.
- Review bundles based on weak topics, vocabulary, and practice samples.
- Authorization preflight and safe recovery instructions.

## Example requests

- “Show the languages on my Duolingo account.”
- “Export my known French words as JSON.”
- “Summarize my Spanish activity from the last 14 days.”
- “Prepare up to 10 Spanish review sentences based on my weak topics.”
- “Show my profile and then build this week's review bundle.”

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

- Recent-learning data maps XP records to selected-language skills and words.
  It cannot reconstruct the exact prompts, answers, or sentences from past
  lessons.
- Practice sentences are current global-practice samples. They can vary between
  calls and are not a replay of completed lessons.
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

## Updating

Before relying on newly documented commands, check `duolingo-cli --help`. If an
installed version lacks a command, upgrade `@yummysource/duolingo-cli` rather
than guessing an older grammar, then reinstall or refresh the Skill using the
same repository source.
