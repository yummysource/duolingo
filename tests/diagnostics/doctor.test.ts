import type { DuolingoClient } from '../../src/client/duolingo.js';
import { DuolingoAuthError } from '../../src/client/errors.js';
import {
  credentialResolutionDoctor,
  missingCredentialsDoctor,
  runDoctor,
} from '../../src/diagnostics/doctor.js';

function healthyClient(): DuolingoClient {
  return {
    getUserData: vi.fn().mockResolvedValue({
      id: 42,
      language_data: { ja: {} },
    }),
    getCurrentCourse: vi.fn().mockResolvedValue({
      id: 'JA_EN',
      subject: 'language',
      topic: 'ja',
      learningLanguage: 'ja',
      fromLanguage: 'en',
    }),
    getLearnedLexemes: vi.fn().mockResolvedValue([]),
  } as unknown as DuolingoClient;
}

describe('runDoctor', () => {
  it('produces a structured missing-credentials diagnosis', () => {
    expect(missingCredentialsDoctor('ja')).toMatchObject({
      status: 'failed',
      credential_source: null,
      language: 'ja',
      checks: [{ code: 'credentials_missing' }],
    });
  });
  it('passes profile, course, and vocabulary probes', async () => {
    const result = await runDoctor(healthyClient(), 'keychain', 'ja');
    expect(result.status).toBe('healthy');
    expect(result.checks.map((check) => check.code)).toEqual([
      'credentials_resolved',
      'profile_ok',
      'course_ok',
      'vocabulary_ok',
    ]);
  });

  it('accepts a valid non-language active course without a learning language', async () => {
    const client = healthyClient();
    vi.spyOn(client, 'getCurrentCourse').mockResolvedValue({
      id: 'DUOLINGO_MATH_ZH-CN',
      subject: 'math',
      topic: 'math',
      fromLanguage: 'zh-CN',
    } as Awaited<ReturnType<DuolingoClient['getCurrentCourse']>>);

    const result = await runDoctor(client, 'keychain');
    expect(result.status).toBe('healthy');
    expect(result.checks.at(-1)).toMatchObject({ code: 'course_ok' });
  });

  it('classifies authentication failures without exposing credentials', async () => {
    const client = {
      getUserData: vi
        .fn()
        .mockRejectedValue(new DuolingoAuthError('JWT expired.')),
    } as unknown as DuolingoClient;
    const result = await runDoctor(client, 'environment');
    expect(result.status).toBe('failed');
    expect(result.checks.at(-1)).toMatchObject({ code: 'auth_failed' });
    expect(JSON.stringify(result)).not.toContain('stored-secret');
  });

  it('classifies missing required response fields as schema drift', async () => {
    const client = {
      getUserData: vi.fn().mockResolvedValue({ language_data: {} }),
    } as unknown as DuolingoClient;
    const result = await runDoctor(client, 'keychain');
    expect(result.checks.at(-1)).toMatchObject({ code: 'schema_drift' });
  });

  it('classifies malformed vocabulary records as schema drift', async () => {
    const client = healthyClient();
    vi.spyOn(client, 'getLearnedLexemes').mockResolvedValue([
      {
        text: 'invalid-audio',
        translations: ['invalid'],
        audioURL: 'not-a-url',
      },
    ]);

    const result = await runDoctor(client, 'keychain', 'ja');
    expect(result.checks.at(-1)).toMatchObject({ code: 'schema_drift' });
  });

  it('turns credential resolution failures into structured diagnostics', () => {
    const result = credentialResolutionDoctor(
      'ja',
      new Error('DUOLINGO_USERNAME and DUOLINGO_JWT must be set together.'),
    );
    expect(result).toMatchObject({
      status: 'failed',
      credential_source: null,
      checks: [{ code: 'credentials_invalid' }],
    });
  });
});
