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
import {
  getVocabularyDataset,
  serializeVocabulary,
} from './services/vocabulary.js';
import {
  credentialResolutionDoctor,
  formatDoctor,
  missingCredentialsDoctor,
  runDoctor,
} from './diagnostics/doctor.js';
import { formatCanary, runLiveCanary } from './diagnostics/canary.js';
import {
  formatSnapshot,
  SnapshotStore,
  type SnapshotDiff,
  type SnapshotStatus,
} from './cli/snapshots.js';

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
  exportVocabulary: async (request, credentials) => {
    const dataset = await getVocabularyDataset(
      new DuolingoClient(credentials.username, credentials.jwt),
      request.language,
      {
        username: request.username,
        limit: request.limit,
      },
    );
    return serializeVocabulary(dataset, request.format);
  },
  runDoctor: async (language, json, credentials, credentialError) => {
    const result =
      credentialError !== undefined
        ? credentialResolutionDoctor(language)
        : credentials === null
          ? missingCredentialsDoctor(language)
          : await runDoctor(
              new DuolingoClient(credentials.username, credentials.jwt),
              credentials.source,
              language,
            );
    return {
      ok: result.status !== 'failed',
      output: json ? JSON.stringify(result, null, 2) : formatDoctor(result),
    };
  },
  runCanary: async (language, json, credentials) => {
    const result = await runLiveCanary(
      () => new DuolingoClient(credentials.username, credentials.jwt),
      language,
    );
    return {
      ok: result.status === 'pass',
      output: json ? JSON.stringify(result, null, 2) : formatCanary(result),
    };
  },
  runSnapshot: async (request, credentials) => {
    const store = new SnapshotStore();
    let value: SnapshotStatus | SnapshotDiff;
    if (request.action === 'init') {
      value = await store.enable(request.language, request.retention);
    } else if (request.action === 'capture') {
      if (credentials === null) {
        throw new Error(
          'Duolingo is not authorized. Run: duolingo-cli auth init',
        );
      }
      value = await store.capture(
        await getVocabularyDataset(
          new DuolingoClient(credentials.username, credentials.jwt),
          request.language,
        ),
      );
    } else if (request.action === 'status') {
      value = await store.status(request.language);
    } else if (request.action === 'diff') {
      value = await store.diff(request.language);
    } else {
      value = await store.disable(request.language, request.deleteData);
    }
    return request.json
      ? JSON.stringify(value, null, 2)
      : formatSnapshot(value);
  },
  startMcp,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

process.exitCode = await runCli(process.argv.slice(2), dependencies);
