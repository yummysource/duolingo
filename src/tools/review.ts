/**
 * Review-focused Duolingo MCP tools.
 *
 * Tools: get_practice_sentences, get_recent_learning, get_review_material
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient, type DuolingoClient } from '../client/duolingo.js';
import type {
  DuolingoCalendarEntry,
  DuolingoSkill,
  DuolingoXpGain,
} from '../client/types.js';
import {
  samplePracticeSentences,
  type PracticeSample,
  type PracticeSentence,
} from '../services/practice.js';
import { handleError, ResponseFormatSchema } from './helpers.js';
import { resolveLanguageSkills } from './language-source.js';

const LanguageAbbrSchema = z
  .string()
  .min(2)
  .max(5)
  .describe("Language abbreviation (e.g. 'fr', 'es', or 'en').");

const FromLanguageSchema = z
  .string()
  .min(2)
  .max(10)
  .optional()
  .describe(
    "Base language abbreviation. Defaults to the authenticated user's matching course.",
  );

const SessionsSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .default(1)
  .describe('Number of global practice sessions to sample (1-10).');

const SentenceLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe('Maximum number of deduplicated sentences to return (1-100).');

interface RecentActivity {
  skill_id: string | null;
  skill_title: string | null;
  xp: number;
  time: number;
  practiced_at: string;
  event_type: string | null;
}

interface RecentSkill {
  id: string;
  name: string;
  title: string;
  strength: number;
  xp: number;
  lesson_count: number;
  last_practiced_at: string;
  words: string[];
}

interface MutableRecentSkill extends RecentSkill {
  lastPracticedTimestamp: number;
}

interface ReviewTopic {
  id: string;
  name: string;
  title: string;
  strength: number;
  progress_percent: number;
  words: string[];
}

async function resolveFromLanguage(
  client: DuolingoClient,
  languageAbbr: string,
  fromLanguage?: string,
): Promise<string> {
  if (fromLanguage !== undefined) return fromLanguage;

  const userData = await client.getUserData();
  const userDataV2 = await client.getUserDataV2(userData.id);
  const course = userDataV2.courses.find(
    (candidate) =>
      candidate.subject === 'language' &&
      (candidate.learningLanguage === languageAbbr ||
        candidate.topic === languageAbbr),
  );
  return course?.fromLanguage ?? userDataV2.fromLanguage;
}

function formatPracticeSentences(
  languageAbbr: string,
  sample: PracticeSample,
): string {
  const lines = [
    `# Practice Sentences (${languageAbbr.toUpperCase()})`,
    '',
    `Sampled ${sample.sessionsReturned} practice session(s); found ${sample.sentences.length} unique sentence(s).`,
  ];

  if (sample.sentences.length === 0) {
    lines.push('', 'No practice sentences were returned by Duolingo.');
    return lines.join('\n');
  }

  for (const [index, sentence] of sample.sentences.entries()) {
    lines.push('', `## ${index + 1}. ${sentence.challenge_type}`);
    if (sentence.prompt !== null)
      lines.push(`- **Prompt**: ${sentence.prompt}`);
    if (sentence.answers.length > 0)
      lines.push(`- **Answer**: ${sentence.answers.join(' / ')}`);
    if (sentence.tokens.length > 0)
      lines.push(`- **Tokens**: ${sentence.tokens.join(' ')}`);
    if (sentence.tts_urls.length > 0)
      lines.push(`- **Audio**: ${sentence.tts_urls.join(' / ')}`);
  }

  return lines.join('\n');
}

function languageNotFound(languageAbbr: string): string {
  return `Language '${languageAbbr}' not found. Make sure you are learning this language.`;
}

function toIsoDate(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString();
}

function calendarEntryToXpGain(entry: DuolingoCalendarEntry): DuolingoXpGain {
  const time =
    entry.datetime >= 10_000_000_000
      ? Math.floor(entry.datetime / 1000)
      : Math.floor(entry.datetime);
  return {
    skillId: entry.skill_id ?? null,
    xp: entry.improvement,
    time,
    eventType: entry.event_type ?? null,
  };
}

function toRecentActivity(
  gain: DuolingoXpGain,
  skillsById: Map<string, DuolingoSkill>,
): RecentActivity {
  const skill =
    gain.skillId === null ? undefined : skillsById.get(gain.skillId);
  return {
    skill_id: gain.skillId,
    skill_title: skill?.title ?? null,
    xp: gain.xp,
    time: gain.time,
    practiced_at: toIsoDate(gain.time),
    event_type: gain.eventType ?? null,
  };
}

function aggregateRecentSkills(
  gains: DuolingoXpGain[],
  skillsById: Map<string, DuolingoSkill>,
): RecentSkill[] {
  const aggregates = new Map<string, MutableRecentSkill>();

  for (const gain of gains) {
    if (gain.skillId === null) continue;
    const skill = skillsById.get(gain.skillId);
    if (skill === undefined) continue;

    const existing = aggregates.get(skill.id);
    if (existing === undefined) {
      aggregates.set(skill.id, {
        id: skill.id,
        name: skill.name,
        title: skill.title,
        strength: skill.strength,
        xp: gain.xp,
        lesson_count: 1,
        last_practiced_at: toIsoDate(gain.time),
        lastPracticedTimestamp: gain.time,
        words: [...new Set(skill.words)].sort(),
      });
      continue;
    }

    existing.xp += gain.xp;
    existing.lesson_count += 1;
    if (gain.time > existing.lastPracticedTimestamp) {
      existing.lastPracticedTimestamp = gain.time;
      existing.last_practiced_at = toIsoDate(gain.time);
    }
  }

  return [...aggregates.values()]
    .sort((a, b) => b.lastPracticedTimestamp - a.lastPracticedTimestamp)
    .map(
      ({ lastPracticedTimestamp: _lastPracticedTimestamp, ...skill }) => skill,
    );
}

function getRecentWords(skills: RecentSkill[]): string[] {
  const words = new Set<string>();
  for (const skill of skills) {
    for (const word of skill.words) words.add(word);
  }
  return [...words].sort();
}

function formatRecentLearning(data: {
  language: string;
  days: number;
  since: string;
  until: string;
  total_xp: number;
  activity_count: number;
  skills: RecentSkill[];
  words: string[];
}): string {
  const lines = [
    `# Recent Learning (${data.language.toUpperCase()})`,
    '',
    `- **Period**: ${data.since.slice(0, 10)} to ${data.until.slice(0, 10)} (${data.days} days)`,
    `- **Total XP**: ${data.total_xp}`,
    `- **Activities**: ${data.activity_count}`,
    '',
    '## Skills',
  ];

  if (data.skills.length === 0) {
    lines.push('', 'No skill-linked learning activity was found.');
  } else {
    for (const skill of data.skills) {
      lines.push(
        `- **${skill.title}**: ${skill.xp} XP across ${skill.lesson_count} activity/activities; strength ${skill.strength}`,
      );
    }
  }

  lines.push('', '## Words', '');
  lines.push(
    data.words.length > 0
      ? data.words.join(', ')
      : 'No words could be mapped to recent skills.',
  );
  return lines.join('\n');
}

function selectReviewTopics(
  skills: DuolingoSkill[],
  topicLimit: number,
): ReviewTopic[] {
  return skills
    .filter((skill) => skill.learned)
    .sort((a, b) => a.strength - b.strength || a.title.localeCompare(b.title))
    .slice(0, topicLimit)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      title: skill.title,
      strength: skill.strength,
      progress_percent: skill.progress_percent,
      words: [...new Set(skill.words)].sort(),
    }));
}

function getReviewWords(topics: ReviewTopic[]): string[] {
  const words = new Set<string>();
  for (const topic of topics) {
    for (const word of topic.words) words.add(word);
  }
  return [...words].sort();
}

function formatReviewMaterial(data: {
  language: string;
  topics: ReviewTopic[];
  words: string[];
  sentences: PracticeSentence[];
  note: string;
}): string {
  const lines = [
    `# Review Material (${data.language.toUpperCase()})`,
    '',
    '## Priority Topics',
  ];

  if (data.topics.length === 0) {
    lines.push('', 'No learned topics were found.');
  } else {
    for (const topic of data.topics) {
      lines.push(`- **${topic.title}** (strength ${topic.strength})`);
    }
  }

  lines.push('', '## Words', '');
  lines.push(data.words.length > 0 ? data.words.join(', ') : 'No words found.');
  lines.push('', '## Practice Sentences');

  if (data.sentences.length === 0) {
    lines.push('', 'No practice sentences were returned by Duolingo.');
  } else {
    for (const [index, sentence] of data.sentences.entries()) {
      const prompt = sentence.prompt ?? sentence.answers[0] ?? '(audio prompt)';
      lines.push('', `${index + 1}. ${prompt}`);
      if (sentence.answers.length > 0 && sentence.prompt !== null) {
        lines.push(`   - Answer: ${sentence.answers.join(' / ')}`);
      }
    }
  }

  lines.push('', `> ${data.note}`);
  return lines.join('\n');
}

export function registerReviewTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // Get Practice Sentences
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_practice_sentences',
    {
      title: 'Get Duolingo Practice Sentences',
      description:
        'Sample current Duolingo global-practice sessions and extract challenge prompts, ' +
        'accepted answers, tokens, and TTS audio URLs. Multiple session samples are deduplicated. ' +
        'This returns current practice material, not an exact history of completed lessons.',
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        from_language: FromLanguageSchema,
        sessions: SessionsSchema,
        sentence_limit: SentenceLimitSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      language_abbr,
      from_language,
      sessions,
      sentence_limit,
      response_format,
    }) => {
      try {
        const client = getClient();
        const resolvedFromLanguage = await resolveFromLanguage(
          client,
          language_abbr,
          from_language,
        );
        const sample = await samplePracticeSentences(
          () =>
            client.getGlobalPracticeSession(
              language_abbr,
              resolvedFromLanguage,
            ),
          sessions,
          sentence_limit,
        );
        const data = {
          language: language_abbr,
          from_language: resolvedFromLanguage,
          sessions_requested: sessions,
          sessions_returned: sample.sessionsReturned,
          sentences: sample.sentences,
          note: 'These are current global practice samples, not an exact history of previously completed lessons.',
        };

        return {
          content: [
            {
              type: 'text',
              text:
                response_format === 'json'
                  ? JSON.stringify(data, null, 2)
                  : formatPracticeSentences(language_abbr, sample),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Recent Learning
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_recent_learning',
    {
      title: 'Get Recent Duolingo Learning',
      description:
        "Get the authenticated user's language-specific recent XP activity and map " +
        'available skill IDs to learning-path topics. Some activities may have XP and ' +
        'event metadata without a skill ID.',
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        days: z
          .number()
          .int()
          .min(1)
          .max(90)
          .default(7)
          .describe('Number of recent days to include (1-90).'),
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, days, response_format }) => {
      try {
        const client = getClient();
        const userData = await client.getUserData();
        const languageData = userData.language_data[language_abbr];
        if (languageData === undefined) {
          return {
            content: [{ type: 'text', text: languageNotFound(language_abbr) }],
          };
        }

        const untilTimestamp = Math.floor(Date.now() / 1000);
        const sinceTimestamp = untilTimestamp - days * 24 * 60 * 60;
        const languageSkills = await resolveLanguageSkills(
          client,
          userData,
          language_abbr,
        );
        const skillsById = new Map(
          languageSkills.map((skill) => [skill.id, skill]),
        );
        const recentGains = languageData.calendar
          .map(calendarEntryToXpGain)
          .filter((gain) => gain.time >= sinceTimestamp)
          .sort((a, b) => b.time - a.time);
        const skills = aggregateRecentSkills(recentGains, skillsById);
        const data = {
          language: language_abbr,
          days,
          since: toIsoDate(sinceTimestamp),
          until: toIsoDate(untilTimestamp),
          total_xp: recentGains.reduce((total, gain) => total + gain.xp, 0),
          activity_count: recentGains.length,
          skills,
          words: getRecentWords(skills),
          activities: recentGains.map((gain) =>
            toRecentActivity(gain, skillsById),
          ),
          note: 'Recent activity comes from the selected language calendar. Some records may not include skill details, and exact historical lesson sentences cannot be reconstructed.',
        };

        return {
          content: [
            {
              type: 'text',
              text:
                response_format === 'json'
                  ? JSON.stringify(data, null, 2)
                  : formatRecentLearning(data),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Get Review Material
  // -------------------------------------------------------------------------
  server.registerTool(
    'duolingo_get_review_material',
    {
      title: 'Get Duolingo Review Material',
      description:
        'Build a review bundle from the weakest learned topics, their vocabulary, and ' +
        'deduplicated current global-practice sentences. This is read-only and does not ' +
        'submit answers, sessions, or progress to Duolingo.',
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        from_language: FromLanguageSchema,
        topic_limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe('Maximum number of learned topics to include (1-20).'),
        sessions: SessionsSchema.default(3),
        sentence_limit: SentenceLimitSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({
      language_abbr,
      from_language,
      topic_limit,
      sessions,
      sentence_limit,
      response_format,
    }) => {
      try {
        const client = getClient();
        const userData = await client.getUserData();
        const languageData = userData.language_data[language_abbr];
        if (languageData === undefined) {
          return {
            content: [{ type: 'text', text: languageNotFound(language_abbr) }],
          };
        }

        const languageSkills = await resolveLanguageSkills(
          client,
          userData,
          language_abbr,
        );
        const topics = selectReviewTopics(languageSkills, topic_limit);
        const resolvedFromLanguage = await resolveFromLanguage(
          client,
          language_abbr,
          from_language,
        );
        const sample = await samplePracticeSentences(
          () =>
            client.getGlobalPracticeSession(
              language_abbr,
              resolvedFromLanguage,
            ),
          sessions,
          sentence_limit,
        );
        const note =
          'Topics are prioritized by low strength. Sentences are current global practice session samples, not exact historical lesson text.';
        const data = {
          language: language_abbr,
          from_language: resolvedFromLanguage,
          topics,
          words: getReviewWords(topics),
          sessions_requested: sessions,
          sessions_returned: sample.sessionsReturned,
          sentences: sample.sentences,
          note,
        };

        return {
          content: [
            {
              type: 'text',
              text:
                response_format === 'json'
                  ? JSON.stringify(data, null, 2)
                  : formatReviewMaterial(data),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}
