import { readFile } from 'node:fs/promises';

describe('live canary workflow', () => {
  it('runs on a schedule and requires protected credentials', async () => {
    const workflow = await readFile('.github/workflows/canary.yml', 'utf8');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('secrets.DUOLINGO_USERNAME');
    expect(workflow).toContain('secrets.DUOLINGO_JWT');
  });

  it('runs both schema diagnosis and the before-after state canary', async () => {
    const workflow = await readFile('.github/workflows/canary.yml', 'utf8');
    expect(workflow).toContain('doctor --language');
    expect(workflow).toContain('canary --language "$CANARY_LANGUAGE"');
    expect(workflow).not.toContain(
      'canary --language "$CANARY_LANGUAGE" --json',
    );
    expect(workflow).toContain('timeout-minutes:');
  });

  it('keeps offline and credentialed live CI signals separate', async () => {
    const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('Test offline contracts');
    expect(workflow).toContain('Check live-test credentials');
    expect(workflow).toContain('Test live API contracts');
    expect(workflow).toContain('Live integration tests skipped');
    expect(workflow).toContain('tests/integration/public-user.test.ts');
  });
});
