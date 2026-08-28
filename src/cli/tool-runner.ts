import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { resetClient } from '../client/duolingo.js';
import { createDuolingoMcpServer } from '../mcp.js';
import type { DuolingoCredentials } from './credentials.js';

export class CliToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliToolError';
  }
}

function restoreEnvironment(
  username: string | undefined,
  jwt: string | undefined,
): void {
  if (username === undefined) delete process.env.DUOLINGO_USERNAME;
  else process.env.DUOLINGO_USERNAME = username;

  if (jwt === undefined) delete process.env.DUOLINGO_JWT;
  else process.env.DUOLINGO_JWT = jwt;
}

function isTextContent(
  value: unknown,
): value is { type: 'text'; text: string } {
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'text' && typeof record.text === 'string';
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter(isTextContent)
    .map((item) => item.text)
    .join('');
}

/** Call one registered MCP tool in-process without external MCP configuration. */
export async function runMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  credentials: DuolingoCredentials,
): Promise<string> {
  const previousUsername = process.env.DUOLINGO_USERNAME;
  const previousJwt = process.env.DUOLINGO_JWT;
  process.env.DUOLINGO_USERNAME = credentials.username;
  process.env.DUOLINGO_JWT = credentials.jwt;
  resetClient();

  const server = createDuolingoMcpServer();
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'duolingo-cli', version: '1.0.0' });

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const result = await client.callTool({ name: toolName, arguments: args });
    const text = extractText(result.content);

    if (result.isError === true || text.startsWith('Error:')) {
      throw new CliToolError(text || `Tool '${toolName}' failed.`);
    }
    return text;
  } finally {
    try {
      await Promise.all([client.close(), serverTransport.close()]);
    } finally {
      resetClient();
      restoreEnvironment(previousUsername, previousJwt);
    }
  }
}
