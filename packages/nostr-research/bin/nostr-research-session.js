#!/usr/bin/env node

import { startJsonlResearchSession } from '../src/jsonl-session.js';

let terminating = false;
let shutdownHold;
const shutdown = new AbortController();
const terminate = (signal) => {
  if (terminating) return;
  terminating = true;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  // Promises alone do not keep Node running. Hold the event loop until the
  // adapter has awaited cancellation and closed every resource it owns.
  shutdownHold = setInterval(() => {}, 1_000);
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
}).finally(() => clearInterval(shutdownHold));
