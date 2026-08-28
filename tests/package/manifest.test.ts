import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  name?: string;
  bin?: Record<string, string>;
  files?: string[];
}

async function readManifest(): Promise<PackageManifest> {
  const value: unknown = JSON.parse(await readFile('package.json', 'utf8'));
  return value as PackageManifest;
}

describe('npm package manifest', () => {
  it('publishes the yummysource CLI package identity', async () => {
    expect((await readManifest()).name).toBe('@yummysource/duolingo-cli');
  });

  it('ships both CLI and MCP binaries', async () => {
    expect((await readManifest()).bin).toEqual({
      'duolingo-cli': 'dist/cli.js',
      'duolingo-mcp': 'dist/server.js',
    });
  });

  it('includes the agent-neutral skill in published files', async () => {
    expect((await readManifest()).files).toContain('skills/duolingo-learn/**');
  });

  it('includes the bilingual README and detailed usage guides', async () => {
    const files = (await readManifest()).files;
    expect(files).toContain('README.zh-TW.md');
    expect(files).toContain('docs/guides/api.md');
    expect(files).toContain('docs/guides/cli.md');
    expect(files).toContain('docs/guides/mcp.md');
    expect(files).toContain('docs/guides/skill.md');
    expect(files).not.toContain('docs/guides/**');
    expect(files).not.toContain('docs/research/**');
    expect(files).not.toContain('docs/plans/**');
  });
});
