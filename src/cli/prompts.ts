import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

interface TerminalReadable extends Readable {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => void;
}

export async function promptText(
  label: string,
  input: Readable = process.stdin,
  output: Writable = process.stderr,
): Promise<string> {
  const terminalInput = input as TerminalReadable;
  const terminalOutput = output as Writable & { isTTY?: boolean };
  const readline = createInterface({
    input,
    output,
    terminal: terminalInput.isTTY === true && terminalOutput.isTTY === true,
  });
  try {
    return await readline.question(label);
  } finally {
    readline.close();
  }
}

/** Read a single line without echoing its contents to the output stream. */
export async function promptSecret(
  label: string,
  input: Readable = process.stdin,
  output: Writable = process.stderr,
): Promise<string> {
  const terminalInput = input as TerminalReadable;
  output.write(label);
  input.setEncoding('utf8');
  const setRawMode =
    terminalInput.isTTY === true
      ? terminalInput.setRawMode?.bind(terminalInput)
      : undefined;
  setRawMode?.(true);

  return new Promise<string>((resolve, reject) => {
    let secret = '';
    let settled = false;

    const cleanup = (): void => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      setRawMode?.(false);
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      output.write('\n');
      resolve(secret);
    };
    const onData = (chunk: string | Buffer): void => {
      for (const character of chunk.toString()) {
        if (character === '\n' || character === '\r') {
          finish();
          return;
        }
        if (character === '\u0003') {
          settled = true;
          cleanup();
          output.write('\n');
          reject(new Error('Authentication cancelled.'));
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          secret = secret.slice(0, -1);
        } else if (character >= ' ') {
          secret += character;
        }
      }
    };
    const onEnd = (): void => finish();
    const onError = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    input.on('data', onData);
    input.once('end', onEnd);
    input.once('error', onError);
    input.resume();
  });
}
