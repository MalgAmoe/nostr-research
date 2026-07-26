#!/usr/bin/env node

import { startJsonlResearchSession } from '../src/jsonl-session.js';

const shutdown = new AbortController();
const terminate = (signal) => {
  if (shutdown.signal.aborted) return;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  shutdown.abort();
};

process.once('SIGINT', () => terminate('SIGINT'));
process.once('SIGTERM', () => terminate('SIGTERM'));

const running = startJsonlResearchSession(process.argv.slice(2), {
  shutdownSignal: shutdown.signal,
});

running.catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});
