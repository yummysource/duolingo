import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createDuolingoMcpServer } from '../../src/mcp.js';

describe('createDuolingoMcpServer', () => {
  it('registers the review tools on every server instance', async () => {
    const server = createDuolingoMcpServer();
    const [serverTransport, clientTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'factory-test', version: '1.0.0' });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);

      expect(names).toEqual(
        expect.arrayContaining([
          'duolingo_get_practice_sentences',
          'duolingo_get_recent_learning',
          'duolingo_get_review_material',
        ]),
      );
    } finally {
      await client.close();
      await serverTransport.close();
    }
  });
});
