import { z } from 'zod';
import type { DuolingoClient } from '../client/duolingo.js';
import {
  DuolingoAuthError,
  DuolingoCaptchaError,
  DuolingoLanguageNotFoundError,
  DuolingoNotFoundError,
  DuolingoRateLimitError,
  DuolingoSchemaError,
} from '../client/errors.js';
import {
  DoctorResultSchema,
  type DoctorResult,
} from '../contracts/diagnostics.js';
import { getVocabularyDataset } from '../services/vocabulary.js';

const UserProbeSchema = z.object({
  id: z.number().int().positive(),
  language_data: z.record(z.unknown()),
});

const CourseProbeSchema = z.object({
  id: z.string().min(1),
  learningLanguage: z.string().min(2).optional(),
  fromLanguage: z.string().min(2),
  subject: z.string(),
});

function classify(error: unknown): { code: string; message: string } {
  if (error instanceof DuolingoAuthError)
    return { code: 'auth_failed', message: error.message };
  if (error instanceof DuolingoCaptchaError)
    return { code: 'captcha', message: error.message };
  if (error instanceof DuolingoRateLimitError)
    return { code: 'rate_limited', message: error.message };
  if (error instanceof DuolingoLanguageNotFoundError)
    return { code: 'language_not_found', message: error.message };
  if (error instanceof DuolingoNotFoundError)
    return { code: 'not_found', message: error.message };
  if (error instanceof DuolingoSchemaError)
    return { code: 'schema_drift', message: error.message };
  if (error instanceof z.ZodError)
    return {
      code: 'schema_drift',
      message: 'Duolingo response no longer matches the expected schema.',
    };
  return {
    code: 'network_or_upstream',
    message: error instanceof Error ? error.message : String(error),
  };
}

/** Probe authorization and critical unofficial API response contracts. */
export async function runDoctor(
  client: DuolingoClient,
  credentialSource: 'environment' | 'keychain',
  language?: string,
): Promise<DoctorResult> {
  const checks: DoctorResult['checks'] = [
    {
      name: 'credentials',
      status: 'pass',
      code: 'credentials_resolved',
      message: `Credentials resolved from ${credentialSource}.`,
    },
  ];

  try {
    const user = await client.getUserData();
    const userProbe = UserProbeSchema.safeParse(user);
    if (!userProbe.success) {
      throw new DuolingoSchemaError(
        'User response is missing required id or language_data fields.',
      );
    }
    checks.push({
      name: 'profile',
      status: 'pass',
      code: 'profile_ok',
      message: 'Authenticated profile endpoint returned required fields.',
    });

    const course = await client.getCurrentCourse(userProbe.data.id);
    if (!CourseProbeSchema.safeParse(course).success) {
      throw new DuolingoSchemaError(
        'Active course response is missing required course fields.',
      );
    }
    checks.push({
      name: 'active_course',
      status: 'pass',
      code: 'course_ok',
      message: 'Active course endpoint returned required fields.',
    });

    if (language !== undefined) {
      const vocabulary = await getVocabularyDataset(client, language, {
        limit: 1,
      });
      checks.push({
        name: 'vocabulary',
        status: 'pass',
        code: 'vocabulary_ok',
        message: `Vocabulary endpoint returned ${vocabulary.count} probe record(s).`,
      });
    }
  } catch (error) {
    const failure = classify(error);
    checks.push({
      name: 'remote_api',
      status: 'fail',
      code: failure.code,
      message: failure.message,
    });
  }

  const failed = checks.some((check) => check.status === 'fail');
  const warned = checks.some((check) => check.status === 'warn');
  return DoctorResultSchema.parse({
    schema_version: '1',
    status: failed ? 'failed' : warned ? 'degraded' : 'healthy',
    credential_source: credentialSource,
    language: language ?? null,
    checks,
  });
}

export function missingCredentialsDoctor(language?: string): DoctorResult {
  return DoctorResultSchema.parse({
    schema_version: '1',
    status: 'failed',
    credential_source: null,
    language: language ?? null,
    checks: [
      {
        name: 'credentials',
        status: 'fail',
        code: 'credentials_missing',
        message: 'No credentials found. Run: duolingo-cli auth init',
      },
    ],
  });
}

export function credentialResolutionDoctor(language?: string): DoctorResult {
  return DoctorResultSchema.parse({
    schema_version: '1',
    status: 'failed',
    credential_source: null,
    language: language ?? null,
    checks: [
      {
        name: 'credentials',
        status: 'fail',
        code: 'credentials_invalid',
        message:
          'Credentials could not be resolved. Configure both environment variables or run: duolingo-cli auth init',
      },
    ],
  });
}

export function formatDoctor(result: DoctorResult): string {
  const lines = [`# Duolingo Doctor — ${result.status}`, ''];
  for (const check of result.checks) {
    lines.push(
      `- **${check.name}** [${check.status.toUpperCase()} / ${check.code}]: ${check.message}`,
    );
  }
  return lines.join('\n');
}
