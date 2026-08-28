#!/usr/bin/env node

import { DuolingoClient, resetClient } from './client/duolingo.js';
import {
  CredentialStore,
  type DuolingoCredentials,
} from './cli/credentials.js';
import { runCli, type CliDependencies } from './cli/program.js';
import { promptSecret, promptText } from './cli/prompts.js';
import { runMcpTool } from './cli/tool-runner.js';
import { DUOLINGO_SERVER_VERSION } from './mcp.js';

async function validateCredentials(
  credentials: DuolingoCredentials,
): Promise<void> {
  const client = new DuolingoClient(credentials.username, credentials.jwt);
  await client.getUserData(credentials.username);
}

async function startMcp(credentials: DuolingoCredentials): Promise<void> {
  process.env.DUOLINGO_USERNAME = credentials.username;
  process.env.DUOLINGO_JWT = credentials.jwt;
  resetClient();
  await import('./server.js');
}

const dependencies: CliDependencies = {
  credentials: new CredentialStore(),
  env: process.env,
  version: DUOLINGO_SERVER_VERSION,
  promptText,
  promptSecret,
  validateCredentials,
  runTool: runMcpTool,
  startMcp,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

process.exitCode = await runCli(process.argv.slice(2), dependencies);
