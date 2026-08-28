import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAccountTools } from './tools/account.js';
import { registerLanguageTools } from './tools/language.js';
import { registerReviewTools } from './tools/review.js';
import { registerShopTools } from './tools/shop.js';

export const DUOLINGO_SERVER_VERSION = '1.0.4';

const SERVER_INSTRUCTIONS =
  'This server provides read-only access to Duolingo learning data via the ' +
  'unofficial Duolingo API. You can query user profiles, streak information, ' +
  'language progress, topics, words, TTS audio, and review material. ' +
  'Authentication requires DUOLINGO_USERNAME and DUOLINGO_JWT.';

/** Create a fresh Duolingo MCP server with every read-only tool registered. */
export function createDuolingoMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'duolingo_mcp',
      version: DUOLINGO_SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerAccountTools(server);
  registerLanguageTools(server);
  registerReviewTools(server);
  registerShopTools(server);

  return server;
}
