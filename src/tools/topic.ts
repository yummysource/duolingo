/** Topic-scoped vocabulary and current practice MCP tools. */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../client/duolingo.js';
import {
  getTopicPracticeMaterial,
  getTopicVocabulary,
  type TopicPracticeResult,
  type TopicVocabularyResult,
} from '../services/topic.js';
import {
  handleError,
  ResponseFormatSchema,
  UsernameFieldSchema,
} from './helpers.js';

const LanguageAbbrSchema = z
  .string()
  .min(2)
  .max(5)
  .describe("Language abbreviation (for example, 'ja', 'fr', or 'es').");

const TopicPositionSchema = z
  .number()
  .int()
  .min(1)
  .describe('One-based topic position shown by language skills.');

const SessionsSchema = z
  .number()
  .int()
  .min(1)
  .max(10)
  .default(1)
  .describe('Number of topic-scoped practice sessions to sample (1-10).');

const SentenceLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe('Maximum number of deduplicated sentences to return (1-100).');

function formatTopicVocabulary(data: TopicVocabularyResult): string {
  const lines = [
    `# Topic ${data.topic.position}: ${data.topic.title}`,
    '',
    `- **Skill ID**: ${data.topic.id}`,
    `- **Course position**: ${data.topic.position} / ${data.topic.total_topics}`,
    `- **Progress**: ${data.topic.finished_levels} / ${data.topic.total_levels} levels`,
    '',
    `## Vocabulary (${data.words.length})`,
  ];
  if (data.words.length === 0) {
    lines.push('', 'No learned lexemes were returned for this topic.');
  } else {
    for (const word of data.words) {
      const translation = word.translations.join(' / ');
      lines.push(
        '',
        `- **${word.text}**${translation ? ` — ${translation}` : ''}`,
      );
    }
  }
  lines.push(
    '',
    '> Vocabulary is derived from the unofficial learned-lexemes API scoped to the selected topic.',
  );
  return lines.join('\n');
}

function formatTopicPractice(data: TopicPracticeResult): string {
  const lines = [
    `# Topic ${data.topic.position}: ${data.topic.title} — Practice`,
    '',
    `Sampled ${data.sessions_returned} topic session(s); found ${data.sentences.length} unique sentence(s).`,
  ];
  if (data.sentences.length === 0) {
    lines.push('', 'No topic practice sentences were returned by Duolingo.');
  } else {
    for (const [index, sentence] of data.sentences.entries()) {
      lines.push('', `## ${index + 1}. ${sentence.challenge_type}`);
      if (sentence.prompt !== null)
        lines.push(`- **Prompt**: ${sentence.prompt}`);
      if (sentence.answers.length > 0) {
        lines.push(`- **Answer**: ${sentence.answers.join(' / ')}`);
      }
      if (sentence.tokens.length > 0) {
        lines.push(`- **Tokens**: ${sentence.tokens.join(' ')}`);
      }
      if (sentence.tts_urls.length > 0) {
        lines.push(`- **Audio**: ${sentence.tts_urls.join(' / ')}`);
      }
    }
  }
  lines.push(
    '',
    '> These are current topic-scoped generated samples, not a complete or historical lesson transcript. The tool does not submit answers or complete sessions.',
  );
  return lines.join('\n');
}

export function registerTopicTools(server: McpServer): void {
  /** Return learned lexemes associated with one numbered active-course topic. */
  server.registerTool(
    'duolingo_get_topic_vocabulary',
    {
      title: 'Get Duolingo Topic Vocabulary',
      description:
        'Return learned lexemes scoped to one numbered topic in the active learning path. ' +
        'Topic positions are one-based and match the order returned by learned skills.',
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        topic_position: TopicPositionSchema,
        username: UsernameFieldSchema,
        response_format: ResponseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ language_abbr, topic_position, username, response_format }) => {
      try {
        const data = await getTopicVocabulary(getClient(), {
          language: language_abbr,
          topicPosition: topic_position,
          ...(username === undefined ? {} : { username }),
        });
        const output = {
          ...data,
          note: 'Vocabulary is derived from the unofficial learned-lexemes API scoped to the selected topic; upstream coverage may vary.',
        };
        return {
          content: [
            {
              type: 'text',
              text:
                response_format === 'json'
                  ? JSON.stringify(output, null, 2)
                  : formatTopicVocabulary(data),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );

  /** Sample current challenge text for one numbered active-course topic. */
  server.registerTool(
    'duolingo_get_topic_practice',
    {
      title: 'Get Duolingo Topic Practice',
      description:
        'Sample and deduplicate current practice challenges for one numbered active-course ' +
        'topic. This creates challenge sessions only; it never submits answers or completes sessions.',
      inputSchema: {
        language_abbr: LanguageAbbrSchema,
        topic_position: TopicPositionSchema,
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
      topic_position,
      sessions,
      sentence_limit,
      response_format,
    }) => {
      try {
        const data = await getTopicPracticeMaterial(getClient(), {
          language: language_abbr,
          topicPosition: topic_position,
          sessions,
          sentenceLimit: sentence_limit,
        });
        const output = {
          ...data,
          note: 'These are current topic-scoped generated samples, not a complete or historical transcript. This read-only tool does not submit answers or complete sessions.',
        };
        return {
          content: [
            {
              type: 'text',
              text:
                response_format === 'json'
                  ? JSON.stringify(output, null, 2)
                  : formatTopicPractice(data),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleError(err) }] };
      }
    },
  );
}
