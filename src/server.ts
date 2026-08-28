#!/usr/bin/env node
/**
 * Duolingo MCP Server
 *
 * A TypeScript MCP server that exposes Duolingo learning data and actions to
 * LLM agents via the unofficial Duolingo REST API.
 *
 * Authentication:
 *   Set the following environment variables before starting the server:
 *   - DUOLINGO_USERNAME: Your Duolingo username
 *   - DUOLINGO_JWT: Your Duolingo JWT token (extracted from browser)
 *
 * Usage:
 *   npm run build && npm start
 *   # or in development:
 *   npx tsx src/server.ts
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDuolingoMcpServer } from './mcp.js';

const server = createDuolingoMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
