# @yummysource/duolingo-cli

[English](README.md) | [繁體中文](README.zh-TW.md)

A TypeScript package that provides a read-only **Duolingo CLI**, a portable
**Skill**, an **API client library**, and an
**[MCP](https://modelcontextprotocol.io) server**.

Built natively in TypeScript against the unofficial Duolingo REST API — no third-party
Duolingo library dependency.

## Table of Contents

- [Choose an Interface](#choose-an-interface)
- [Quick Start by Scenario](#quick-start-by-scenario)
- [Getting Your JWT Token](#getting-your-jwt-token)
- [CLI](#cli)
- [Skill](#skill)
- [MCP Server](#mcp-server)
  - [Installation](#mcp-installation)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code](#claude-code)
  - [Available Tools](#available-tools)
- [Library](#library)
  - [Installation](#library-installation)
  - [Quick Start](#quick-start)
  - [API Reference](#api-reference)
- [Development](#development)

## Choose an Interface

All four interfaces use the same TypeScript client and unofficial Duolingo API.
Choose the thinnest layer that matches the job:

| Interface | Best for                                             | Setup                                                | Output                     |
| --------- | ---------------------------------------------------- | ---------------------------------------------------- | -------------------------- |
| API       | TypeScript applications and custom data pipelines    | Install the package and instantiate `DuolingoClient` | Typed objects              |
| CLI       | People, shell scripts, CI jobs, and local automation | Install `duolingo-cli`, then run `auth init` once    | Markdown or JSON           |
| Skill     | Cross-agent natural-language learning workflows      | Install the CLI and `duolingo-learn` Skill           | Agent-selected CLI results |
| MCP       | MCP-compatible clients and existing tool workflows   | Start `duolingo-cli mcp`                             | MCP tool responses         |

Every provided operation is read-only. The project does not submit answers,
purchase items, alter progress, or modify account settings.

### Capability boundaries

| Capability                          | API | CLI | Skill | MCP |
| ----------------------------------- | --- | --- | ----- | --- |
| Versioned vocabulary dataset        | ✓   | ✓   | ✓     | ✓   |
| CSV / TSV / Anki-friendly export    | ✓   | ✓   | ✓     | —   |
| Credential and schema diagnostics   | —   | ✓   | ✓     | —   |
| Before/after live state canary      | —   | ✓   | ✓     | —   |
| Opt-in local snapshots and diffs    | —   | ✓   | ✓     | —   |
| Topic categories, progress, and TTS | ✓   | —   | —     | ✓   |
| Numbered-topic vocabulary           | ✓   | ✓   | ✓     | ✓   |
| Numbered-topic practice samples     | ✓   | ✓   | ✓     | ✓   |

The CLI and Skill intentionally own local files and diagnostics. MCP exposes
the shared vocabulary object as `structuredContent`; it does not write export
or snapshot files.

## Quick Start by Scenario

### Review what you learned recently

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli auth init
duolingo-cli review recent --language es --days 7 --json
duolingo-cli review material --language es --limit 10 --json
```

### Add Duolingo to an automation agent

```bash
npx skills add yummysource/duolingo -y -g
```

Then ask for a task such as “summarize my Spanish learning from the last seven
days and prepare up to ten review sentences.” The Skill checks authorization,
selects stable CLI commands, and explains the limits of Duolingo's activity
data.

### Use the TypeScript API

```typescript
import { DuolingoClient } from '@yummysource/duolingo-cli';

const client = new DuolingoClient(username, jwt);
const profile = await client.getUserData();
console.log(profile.site_streak);
```

### Connect an MCP client

```bash
duolingo-cli mcp
```

Detailed guides:

- [API guide](docs/guides/api.md)
- [CLI guide](docs/guides/cli.md)
- [Skill guide](docs/guides/skill.md)
- [MCP guide](docs/guides/mcp.md)

---

## Getting Your JWT Token

Authenticated queries require a Duolingo username and JWT token. The CLI stores
the JWT in the operating system's credential manager and never displays it.

1. Log in to [duolingo.com](https://www.duolingo.com) in your browser.
2. Open the browser developer console (F12 → Console tab).
3. Run:
   ```js
   document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'))[0].slice(11);
   ```
4. Copy the output — that is your JWT token.

> **Note**: JWT tokens expire. If authentication fails, repeat these steps and
> run `duolingo-cli auth init` again. Never commit the token or paste it into chat.

---

## CLI

See the [complete CLI guide](docs/guides/cli.md) for command parameters, output
contracts, exit codes, credential precedence, and scenario-based examples.

Install the package and configure credentials once:

```bash
npm install -g @yummysource/duolingo-cli
duolingo-cli auth init
duolingo-cli auth show
```

`auth init` prompts interactively and hides JWT input. Complete
`DUOLINGO_USERNAME` and `DUOLINGO_JWT` environment variables take precedence
when both are set; partial environment credentials are rejected.

Common read-only queries:

```bash
duolingo-cli account profile --json
duolingo-cli account streak --json
duolingo-cli account daily-xp --json
duolingo-cli course list --json
duolingo-cli social leaderboard --unit week --json
duolingo-cli resource hearts --json
duolingo-cli resource currencies --json
duolingo-cli shop items --json
duolingo-cli goal streak --json
duolingo-cli language list --abbreviations --json
duolingo-cli language words --language es --json
duolingo-cli language recent-words --language ja --limit 10 --json
duolingo-cli language export --language ja --format anki > japanese-anki.tsv
duolingo-cli topic words --language ja --topic 53 --json
duolingo-cli topic sentences --language ja --topic 53 --limit 10 --json
duolingo-cli review recent --language es --days 7 --json
duolingo-cli review sentences --language es --limit 10 --json
duolingo-cli review material --language es --topics 5 --limit 10 --json
duolingo-cli doctor --language ja --json
duolingo-cli canary --language ja --json
```

Run `duolingo-cli --help` for the complete command grammar. Recent XP and
activities come from the selected language's calendar. For newer courses whose
legacy skill tree is empty, the CLI automatically falls back to the current
learning path for topics and to Duolingo's learned-lexemes query for known
words. Some activities still lack a skill ID. Exact historical lesson
sentences are not available; review sentences are current practice samples and
may vary. `language recent-words` follows Duolingo's newest-first learned-date
ranking, but the API does not expose exact per-word timestamps.
`topic words` and `topic sentences` use the one-based order shown by
`language skills`. Topic sentences are current generated samples for that
topic, not a complete or historical lesson transcript.

---

## Skill

See the [complete Skill guide](docs/guides/skill.md) for installation,
cross-agent behavior, example requests, and security boundaries.

Install the agent-neutral `duolingo-learn` Skill from this repository:

```bash
npx skills add yummysource/duolingo -y -g
```

The Skill uses `duolingo-cli` only. It contains no Agent-specific metadata,
runtime, or MCP configuration:

```text
skills/duolingo-learn/
├── SKILL.md
└── references/
    └── cli-commands.md
```

---

## MCP Server

See the [complete MCP guide](docs/guides/mcp.md) for transport setup,
authentication choices, client configuration, tool groups, and inspection.

### MCP Installation

**Option A — use the installed CLI and stored credentials:**

```bash
duolingo-cli mcp
```

**Option B — run without a global install:**

```bash
npx --package @yummysource/duolingo-cli duolingo-cli mcp
```

**Option C — clone and build from source:**

```bash
git clone https://github.com/yummysource/duolingo.git
cd duolingo
npm install && npm run build
node dist/server.js
```

### Claude Desktop

Run `duolingo-cli auth init`, then add this to
`~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Claude Code

After `duolingo-cli auth init`, register the stored-credential command:

```bash
claude mcp add duolingo -- duolingo-cli mcp
```

For CI or externally managed secrets, set both environment variables instead:

```bash
export DUOLINGO_USERNAME="your_username"
export DUOLINGO_JWT="your_jwt_token"
```

### Available Tools

All tools are **read-only** — the server never modifies your Duolingo account.

#### Account

| Tool                             | Description                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `duolingo_get_user_info`         | Profile: username, name, bio, location, avatar, followers, learning language |
| `duolingo_get_settings`          | Notification and account settings                                            |
| `duolingo_get_streak_info`       | Current streak, longest streak, daily goal, extended today                   |
| `duolingo_get_daily_xp_progress` | XP goal, XP earned today, lessons completed today                            |
| `duolingo_get_languages`         | Languages being learned (full names or abbreviations)                        |
| `duolingo_get_courses`           | All courses including Math, Chess, and Music with XP per course              |
| `duolingo_get_friends`           | Users the authenticated user follows, with total XP                          |
| `duolingo_get_calendar`          | Recent activity calendar for the current course (~last 2 weeks)              |
| `duolingo_get_leaderboard`       | Authenticated user's friends sorted by XP for week or month                  |
| `duolingo_get_shop_items`        | Full shop catalogue with prices and item types                               |
| `duolingo_get_health`            | Current hearts count, max hearts, refill timing                              |
| `duolingo_get_currencies`        | Gem and lingot balances                                                      |
| `duolingo_get_streak_goal`       | Current streak goal with upcoming checkpoints                                |

#### Language

| Tool                             | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `duolingo_get_language_details`  | Level, points, streak for a specific language             |
| `duolingo_get_language_progress` | Detailed progress: level %, points to next level, fluency |
| `duolingo_get_known_topics`      | Learned topic/skill names                                 |
| `duolingo_get_unknown_topics`    | Not-yet-learned topics                                    |
| `duolingo_get_golden_topics`     | Fully mastered topics (strength = 1.0)                    |
| `duolingo_get_reviewable_topics` | Learned but not fully mastered topics                     |
| `duolingo_get_known_words`       | Set of known words for a language                         |
| `duolingo_get_recent_words`      | Latest learned words in Duolingo's newest-first ranking   |
| `duolingo_get_vocabulary`        | Versioned vocabulary dataset with structured MCP output   |
| `duolingo_get_learned_skills`    | Full skill objects sorted by learning order               |
| `duolingo_get_language_voices`   | Available TTS voice names for a language                  |
| `duolingo_get_audio_url`         | Pronunciation audio URL for a word                        |

#### Numbered Topics

| Tool                            | Description                                               |
| ------------------------------- | --------------------------------------------------------- |
| `duolingo_get_topic_vocabulary` | Learned lexemes scoped to one active-course topic         |
| `duolingo_get_topic_practice`   | Current generated prompts and answers scoped to one topic |

#### Review

| Tool                              | Description                                                       |
| --------------------------------- | ----------------------------------------------------------------- |
| `duolingo_get_recent_learning`    | Recent XP activity mapped to skills and words                     |
| `duolingo_get_practice_sentences` | Deduplicated current practice prompts, answers, tokens, and audio |
| `duolingo_get_review_material`    | Weak topics, vocabulary, and current practice samples             |

#### Utilities

| Tool                              | Description                                                       |
| --------------------------------- | ----------------------------------------------------------------- |
| `duolingo_get_language_from_abbr` | Convert language abbreviation to full name (e.g. `fr` → `French`) |
| `duolingo_get_abbreviation_of`    | Convert full language name to abbreviation (e.g. `French` → `fr`) |

---

## Library

See the [complete API guide](docs/guides/api.md) for authentication, method
groups, caching, error handling, and review-data composition.

### Library Installation

```bash
npm install @yummysource/duolingo-cli
```

### Quick Start

```typescript
import { DuolingoClient } from '@yummysource/duolingo-cli';

const client = new DuolingoClient('your_username', 'your_jwt_token');

// Get all courses including Math, Chess, and Music
const userData = await client.getUserData();
const userId = userData.id;
const v2 = await client.getUserDataV2(userId);
for (const course of v2.courses) {
  console.log(`${course.subject}: ${course.xp} XP`);
}

// Get streak info
const streak = v2.streak;
const longestStreak = v2.streakData.longestStreak?.length;

// Get friends
const friends = await client.getFollowing(userId);
for (const friend of friends) {
  console.log(`${friend.username}: ${friend.totalXp} XP`);
}

// Get shop items
const items = await client.getShopItems();
const streakFreeze = items.find((i) => i.id === 'streak_freeze');

// Get hearts
const health = await client.getHealth();
console.log(`Hearts: ${health.hearts}/${health.maxHearts}`);
```

### API Reference

#### `new DuolingoClient(username, jwt)`

Creates a new client instance. Results are cached per instance.

```typescript
const client = new DuolingoClient('your_username', 'your_jwt_token');
```

#### User Data

```typescript
// Legacy API — returns language_data with skills, calendar, etc.
// Required for: language details, topics, known words, learned skills
const userData = await client.getUserData(username?);

// 2023-05-23 API — returns all courses (language + math/chess/music),
// richer streak data, subscriber level, gems, health
const userId = userData.id;
const v2 = await client.getUserDataV2(userId);

// Resolve a username to a numeric user ID
const id = await client.getUserIdByUsername('someuser');
```

#### Courses (all subjects)

```typescript
const v2 = await client.getUserDataV2(userId);

// All courses
v2.courses; // DuolingoCourse[]

// Filter by subject
const langCourses = v2.courses.filter((c) => c.subject === 'language');
const mathCourses = v2.courses.filter((c) => c.subject === 'math');
const chessCourses = v2.courses.filter((c) => c.subject === 'chess');
const musicCourses = v2.courses.filter((c) => c.subject === 'music');
```

Each course has: `id`, `subject`, `topic`, `xp`, `fromLanguage`.
Language courses also have: `learningLanguage`, `title`, `authorId`.

#### Daily XP Progress

```typescript
const progress = await client.getUserDataById(userId, [
  'xpGoal',
  'xpGains',
  'streakData',
]);
// progress.xpGoal    — daily XP goal
// progress.xpGains   — array of { xp, skillId, time } for recent lessons
// progress.streakData.updatedTimestamp — last streak update
```

#### Friends & Social

```typescript
// People this user follows (= friends)
const following = await client.getFollowing(userId);
// following[0].username, .totalXp, .userScore?.score (weekly XP), .isFollowedBy

// People who follow this user
const followers = await client.getFollowers(userId);
```

#### Shop, Health & Currencies

```typescript
// Full shop catalogue (read-only)
const items = await client.getShopItems();
// items[0].id, .name, .type, .price, .currencyType, .lastUsedDate

// Hearts / health (authenticated user only)
const health = await client.getHealth();
// health.hearts, .maxHearts, .eligibleForFreeRefill, .secondsUntilNextHeartSegment

// Gem and lingot balances (authenticated user only)
const { gems, lingots } = await client.getCurrencies();
```

#### Streak Goals

```typescript
// Current streak goal with checkpoints
const goal = await client.getStreakGoalCurrent();
// goal.hasActiveGoal, goal.streakGoal.lastCompleteGoal, .checkpoints, .nextSelectedGoal

// Available next goal options
const options = await client.getStreakGoalNextOptions();
```

#### TTS Audio

```typescript
// Discover available voices for a language
const voices = await client.getLanguageVoices('es'); // ['beaes', 'juniores', ...]

// Build an audio URL
const url = await client.buildAudioUrl('hola', 'es');
const urlWithVoice = await client.buildAudioUrl('hola', 'es', 'beaes');
```

#### Error Handling

```typescript
import {
  DuolingoClient,
  DuolingoAuthError,
  DuolingoNotFoundError,
  DuolingoCaptchaError,
  DuolingoClientError,
} from '@yummysource/duolingo-cli';

try {
  const data = await client.getUserData('someuser');
} catch (err) {
  if (err instanceof DuolingoAuthError) {
    // JWT expired — extract a new one from the browser
  } else if (err instanceof DuolingoNotFoundError) {
    // User does not exist
  } else if (err instanceof DuolingoCaptchaError) {
    // Duolingo blocked the request — try again later
  } else if (err instanceof DuolingoClientError) {
    // Other API error
  }
}
```

---

## Development

```bash
git clone https://github.com/yummysource/duolingo.git
cd duolingo
npm install

# Build
npm run build

# Run tests (unit + integration)
npm test

# Integration tests require credentials:
export DUOLINGO_USERNAME="your_username"
export DUOLINGO_JWT="your_jwt_token"
npm test

# Type-check without building
npm run typecheck

# Run MCP server in dev mode (no build step)
npm run dev
```

### Project Structure

```
src/
├── cli.ts             # duolingo-cli entry point
├── index.ts           # Library entry point — exports client, types, errors
├── mcp.ts             # Shared MCP server factory
├── server.ts          # duolingo-mcp stdio entry point
├── cli/               # Commands, auth, prompts, and in-memory tool runner
├── client/
│   ├── duolingo.ts    # DuolingoClient — all API methods
│   ├── types.ts       # TypeScript interfaces for all API responses
│   └── errors.ts      # Custom error classes
├── services/          # Vocabulary, topic, and practice normalization
└── tools/
    ├── account.ts     # Account tools (13)
    ├── language.ts    # Language tools (12)
    ├── review.ts      # Review tools (3)
    ├── shop.ts        # Utility tools (2)
    ├── topic.ts       # Numbered-topic tools (2)
    └── helpers.ts     # Shared utilities (error handling, Zod schemas)
skills/
└── duolingo-learn/    # Portable CLI Skill and command reference
```

### API Versions Used

| Endpoint                                   | API Version | Used For                                      |
| ------------------------------------------ | ----------- | --------------------------------------------- |
| `/users/<username>`                        | Legacy      | User profile, language data, skills, calendar |
| `/2023-05-23/users/{id}`                   | Current     | Courses (all subjects), streak, health, gems  |
| `/2023-05-23/friends/users/{id}/following` | Current     | Friends, leaderboard                          |
| `/2023-05-23/shop-items`                   | Current     | Shop catalogue                                |
| `/users/{id}/streak-goal-current`          | Current     | Streak goals                                  |
| `/2017-06-30/sessions`                     | Current     | TTS voice discovery                           |
| `/courses/.../learned-lexemes`             | Current     | Global and topic-scoped learned vocabulary    |
| `/2023-05-23/sessions`                     | Current     | Topic-scoped generated practice challenges    |

---

## License

MIT — see [LICENSE](LICENSE)
