import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const workflowPath = resolve('.github/workflows/publish.yml');

describe('npm publish workflow', () => {
  it('publishes releases with npm authentication and provenance', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('push:');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('release:');
    expect(workflow).toContain('- published');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain(
      'ref: ${{ github.event.release.tag_name || inputs.tag || github.sha }}',
    );
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}');
    expect(workflow).toContain('npm publish --provenance --access public');
  });

  it('verifies the release tag and runs all quality gates', async () => {
    const workflow = await readFile(workflowPath, 'utf8');

    expect(workflow).toContain('Verify release version');
    expect(workflow).toContain('Check npm version');
    expect(workflow).toContain("already_published != 'true'");
    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npm run format:check');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
  });
});
