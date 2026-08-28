import { PassThrough, Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { promptSecret, promptText } from '../../src/cli/prompts.js';

function capture(stream: PassThrough): string {
  return stream.read()?.toString() ?? '';
}

describe('CLI prompts', () => {
  it('reads visible text input', async () => {
    const input = Readable.from(['alice\n']);
    const output = new PassThrough();

    await expect(promptText('Username: ', input, output)).resolves.toBe(
      'alice',
    );
    expect(capture(output)).toContain('Username: ');
  });

  it('does not echo secret input', async () => {
    const input = Readable.from(['jwt-secret\n']);
    const output = new PassThrough();

    await expect(promptSecret('JWT: ', input, output)).resolves.toBe(
      'jwt-secret',
    );
    const rendered = capture(output);
    expect(rendered).toContain('JWT: ');
    expect(rendered).not.toContain('jwt-secret');
  });
});
