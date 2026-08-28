/**
 * @yummysource/duolingo-cli — public library API
 *
 * Use this entry point when importing the package as a library:
 *
 *   import { DuolingoClient } from '@yummysource/duolingo-cli';
 *
 * For the MCP server binary, use the `duolingo-mcp` CLI (installed via
 * `npm install -g @yummysource/duolingo-cli`) or the
 * `@yummysource/duolingo-cli/server` export.
 */

// Client class and singleton helpers
export { DuolingoClient, getClient, resetClient } from './client/duolingo.js';

// All error classes
export {
  DuolingoClientError,
  DuolingoAuthError,
  DuolingoNotFoundError,
  DuolingoCaptchaError,
  DuolingoLanguageNotFoundError,
  DuolingoRateLimitError,
  DuolingoSchemaError,
} from './client/errors.js';

// Shared application contracts and vocabulary use case
export {
  VocabularyWordSchema,
  VocabularyDatasetSchema,
  VocabularyExportFormatSchema,
} from './contracts/vocabulary.js';
export {
  getVocabularyDataset,
  serializeVocabulary,
} from './services/vocabulary.js';
export {
  getTopicPracticeMaterial,
  getTopicVocabulary,
  resolveCourseTopic,
} from './services/topic.js';
export type {
  VocabularyWord,
  VocabularyDataset,
  VocabularyExportFormat,
} from './contracts/vocabulary.js';
export type {
  ResolvedCourseTopic,
  TopicPathLocation,
  TopicPracticeRequest,
  TopicPracticeResult,
  TopicRequest,
  TopicVocabularyResult,
} from './services/topic.js';

// All public types
export type {
  // Core user data
  DuolingoUserData,
  DuolingoUserDataV2,
  DuolingoLanguage,
  DuolingoLanguageData,
  DuolingoCalendarEntry,
  DuolingoSkill,
  DuolingoTrackingProperties,

  // Courses (language + math/chess/music)
  DuolingoCourse,

  // Current learning path and vocabulary
  DuolingoCurrentCourse,
  DuolingoPathLevelClientData,
  DuolingoPathLevel,
  DuolingoPathUnit,
  DuolingoPathSection,
  DuolingoPathSkill,
  DuolingoLearnedLexeme,
  DuolingoLearnedLexemeOptions,
  DuolingoLexemeSort,
  DuolingoLearnedLexemesResponse,
  DuolingoSkillPracticeOptions,
  DuolingoSkillProgress,

  // Friends / social
  DuolingoFriendUser,
  DuolingoFollowingResponse,
  DuolingoFollowersResponse,

  // Daily progress
  DuolingoDailyProgress,
  DuolingoXpGain,
  DuolingoStreakData,

  // Streak (v2)
  DuolingoStreakDataV2,
  DuolingoStreakInfo,

  // Streak goals
  DuolingoStreakGoal,
  DuolingoStreakGoalCheckpoint,
  DuolingoStreakGoalCurrentResponse,
  DuolingoStreakGoalNextOptionsResponse,
  DuolingoStreakGoalOption,

  // Shop
  DuolingoShopItem,

  // Health / hearts
  DuolingoHealth,

  // Leaderboard (legacy)
  DuolingoLeaderboardData,

  // Session / TTS
  DuolingoSessionRequest,
  DuolingoSessionResponse,
  DuolingoChallenge,
  DuolingoToken,
} from './client/types.js';
