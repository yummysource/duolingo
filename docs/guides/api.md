# TypeScript API Guide

[Back to README](../../README.md) · [繁體中文總覽](../../README.zh-TW.md)

Use the API when an application needs typed Duolingo data or custom processing
that is more specific than the CLI, Skill, or MCP interfaces.

## Install

```bash
npm install @yummysource/duolingo-cli
```

The package is ESM and requires Node.js 18 or newer.

## Authenticate

```typescript
import { DuolingoClient } from '@yummysource/duolingo-cli';

const client = new DuolingoClient(
  process.env.DUOLINGO_USERNAME!,
  process.env.DUOLINGO_JWT!,
);
```

Applications are responsible for providing credentials securely. Do not embed a
JWT in source code, logs, browser bundles, or committed environment files. The
CLI credential manager is intentionally separate from the library constructor.

## Account and course data

```typescript
const legacy = await client.getUserData();
const current = await client.getUserDataV2(legacy.id);

console.log({
  username: legacy.username,
  streak: current.streak,
  courses: current.courses.map((course) => ({
    subject: course.subject,
    title: course.title,
    xp: course.xp,
  })),
});
```

The legacy user endpoint contains language trees, skills, words, and calendars.
The current endpoint contains richer course, subscription, streak, health, and
currency fields. Many workflows need both representations.

## Public methods

| Area     | Methods                                                                                                      | Notes                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| User     | `getUserData`, `getUserDataV2`, `getUserDataById`, `getUserIdByUsername`                                     | Profile, courses, XP activity, and ID resolution                    |
| Social   | `getFollowing`, `getFollowers`, `getLeaderboard`                                                             | Social graph and leaderboard data                                   |
| Account  | `getShopItems`, `getHealth`, `getCurrencies`                                                                 | Read-only catalogue and balances                                    |
| Streak   | `getStreakGoalCurrent`, `getStreakGoalNextOptions`                                                           | Current goal and available next goals                               |
| Practice | `getGlobalPracticeSession`, `getSession`                                                                     | Current practice samples; `getSession` delegates to global practice |
| Audio    | `getTtsBaseUrl`, `getLanguageVoices`, `buildAudioUrl`, `populateVoiceUrlDictionary`, `getVoiceUrlDictionary` | TTS discovery and URL construction                                  |
| Cache    | `invalidateCache`                                                                                            | Clears cached legacy user data                                      |

## Build recent-learning data

Recent XP records are returned by `getUserDataById`. Map their `skillId` values
to the selected language's legacy skills:

```typescript
const user = await client.getUserData();
const spanish = user.language_data.es;
const activity = await client.getUserDataById(user.id, [
  'xpGains',
  'streakData',
]);
const skillsById = new Map(spanish.skills.map((skill) => [skill.id, skill]));

const mapped = activity.xpGains.flatMap((gain) => {
  if (gain.skillId === null) return [];
  const skill = skillsById.get(gain.skillId);
  return skill === undefined ? [] : [{ gain, skill }];
});
```

Duolingo's activity records do not contain the exact prompts and answers shown
in completed lessons. They support skill, word, timestamp, and XP summaries.

## Sample current practice material

```typescript
const session = await client.getGlobalPracticeSession('es', 'en');
const challenges = session?.challenges ?? [];
```

The second argument is the course's base language. Do not assume it is English;
derive it from the matching v2 course when possible. Practice responses are
current randomized samples, may be empty, and may differ between calls.

For the repository's ready-made aggregation and normalization, use
`duolingo-cli review ...` or the three Review MCP tools rather than duplicating
their parsing logic.

## Cache behavior

`getUserData` and `getUserDataV2` cache results for the lifetime of a client
instance. Use `invalidateCache(username?)` for legacy user data or construct a
new client when a workflow needs a completely fresh snapshot.

## Error handling

```typescript
import {
  DuolingoAuthError,
  DuolingoCaptchaError,
  DuolingoClientError,
  DuolingoLanguageNotFoundError,
  DuolingoNotFoundError,
} from '@yummysource/duolingo-cli';

try {
  await client.getUserData();
} catch (error) {
  if (error instanceof DuolingoAuthError) {
    // Refresh credentials without logging the old token.
  } else if (error instanceof DuolingoNotFoundError) {
    // The requested user does not exist.
  } else if (error instanceof DuolingoCaptchaError) {
    // Duolingo rejected the automated request.
  } else if (error instanceof DuolingoLanguageNotFoundError) {
    // The requested language is not present on the account.
  } else if (error instanceof DuolingoClientError) {
    // Another API or response error.
  }
}
```

## Read-only boundary

The client methods exposed by this package retrieve data and practice samples.
They do not submit lesson answers, purchase shop items, change account settings,
or write learning progress.
