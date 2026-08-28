import type {
  DuolingoChallenge,
  DuolingoSessionResponse,
} from '../client/types.js';

export interface PracticeSentence {
  challenge_type: string;
  prompt: string | null;
  answers: string[];
  tokens: string[];
  tts: string | null;
  tts_urls: string[];
}

export interface PracticeSample {
  sentences: PracticeSentence[];
  sessionsReturned: number;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function collectTokenText(value: unknown, output: string[]): void {
  const text = readOptionalString(value);
  if (text !== null) {
    output.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTokenText(item, output);
    return;
  }
  if (!isRecord(value)) return;

  for (const key of ['value', 'text', 'token']) {
    const token = readOptionalString(value[key]);
    if (token !== null) {
      output.push(token);
      return;
    }
  }
}

function collectStrings(value: unknown): string[] {
  const strings: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readOptionalString(item);
      if (text !== null) pushUnique(strings, text);
    }
  } else {
    const text = readOptionalString(value);
    if (text !== null) strings.push(text);
  }
  return strings;
}

function collectTtsUrls(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) pushUnique(output, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTtsUrls(item, output);
    return;
  }
  if (!isRecord(value)) return;
  for (const item of Object.values(value)) collectTtsUrls(item, output);
}

function getChallengeAnswers(challenge: Record<string, unknown>): string[] {
  const correctSolutions = collectStrings(challenge.correctSolutions);
  if (correctSolutions.length > 0) return correctSolutions;

  const directAnswer =
    readOptionalString(challenge.correctSolution) ??
    readOptionalString(challenge.correctAnswer);
  if (directAnswer !== null) return [directAnswer];

  const correctTokens: string[] = [];
  collectTokenText(challenge.correctTokens, correctTokens);
  if (correctTokens.length > 0) return [correctTokens.join(' ')];

  const choices = challenge.choices;
  const correctIndex = challenge.correctIndex;
  if (
    Array.isArray(choices) &&
    typeof correctIndex === 'number' &&
    Number.isInteger(correctIndex)
  ) {
    const choice: unknown = choices[correctIndex];
    if (isRecord(choice)) {
      const choiceText =
        readOptionalString(choice.phrase) ?? readOptionalString(choice.text);
      return choiceText === null ? [] : [choiceText];
    }
    const choiceText = readOptionalString(choice);
    return choiceText === null ? [] : [choiceText];
  }
  return [];
}

export function extractPracticeSentence(
  challenge: DuolingoChallenge,
): PracticeSentence | null {
  const record: Record<string, unknown> = challenge;
  const prompt = readOptionalString(record.prompt);
  const answers = getChallengeAnswers(record);
  if (prompt === null && answers.length === 0) return null;

  const tokens: string[] = [];
  collectTokenText(record.tokens, tokens);
  if (tokens.length === 0) collectTokenText(record.correctTokens, tokens);
  if (tokens.length === 0) collectTokenText(record.displayTokens, tokens);

  const ttsUrls: string[] = [];
  collectTtsUrls(record.tts, ttsUrls);
  collectTtsUrls(record.tokens, ttsUrls);
  collectTtsUrls(record.correctTokens, ttsUrls);
  collectTtsUrls(record.displayTokens, ttsUrls);
  if (isRecord(record.metadata)) {
    const nonCharacterTts = record.metadata.non_character_tts;
    if (isRecord(nonCharacterTts))
      collectTtsUrls(nonCharacterTts.tokens, ttsUrls);
  }

  return {
    challenge_type:
      readOptionalString(record.type) ??
      readOptionalString(record.challengeType) ??
      'unknown',
    prompt,
    answers,
    tokens,
    tts: ttsUrls[0] ?? null,
    tts_urls: ttsUrls,
  };
}

function practiceSentenceKey(sentence: PracticeSentence): string {
  const text = sentence.prompt ?? sentence.answers.join(' ');
  return normalizeWhitespace(text).toLocaleLowerCase();
}

export async function samplePracticeSentences(
  fetchSession: () => Promise<DuolingoSessionResponse | null>,
  sessions: number,
  sentenceLimit: number,
): Promise<PracticeSample> {
  const responses = await Promise.all(
    Array.from({ length: sessions }, () => fetchSession()),
  );
  const sentences: PracticeSentence[] = [];
  const seen = new Set<string>();
  const sessionsReturned = responses.filter(
    (response) => response !== null,
  ).length;

  for (const response of responses) {
    if (response === null) continue;
    for (const challenge of response.challenges) {
      const sentence = extractPracticeSentence(challenge);
      if (sentence === null) continue;
      const key = practiceSentenceKey(sentence);
      if (seen.has(key)) continue;
      seen.add(key);
      sentences.push(sentence);
      if (sentences.length >= sentenceLimit) {
        return { sentences, sessionsReturned };
      }
    }
  }
  return { sentences, sessionsReturned };
}
