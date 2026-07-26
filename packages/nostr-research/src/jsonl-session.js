import { createInterface } from 'node:readline';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  ResearchMemoryError,
} from './index.js';

const HELP = `Usage: nostr-research-session --capacity <1-1000>

Reads one JSON command per non-empty UTF-8 input line and writes one JSON
response line. The process owns one bounded, process-local research session.
`;

export async function startJsonlResearchSession(args, streams = {}) {
  const options = parseArguments(args);
  const output = streams.output ?? process.stdout;
  if (options.help) {
    output.write(HELP);
    return;
  }

  const input = streams.input ?? process.stdin;
  const memory = createInMemoryResearchMemory({ capacity: options.capacity });
  const session = createDeclarativeResearchSession(memory);
  const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
  let closing;
  const close = () => {
    if (!closing) closing = session.close();
    return closing;
  };
  const shutdownSignal = streams.shutdownSignal;
  const shutdown = () => {
    lines.close();
    void close();
  };
  shutdownSignal?.addEventListener('abort', shutdown, { once: true });

  try {
    if (shutdownSignal?.aborted) shutdown();
    for await (const line of lines) {
      if (line.trim().length === 0) continue;
      let response;
      try {
        response = await session.execute(JSON.parse(line));
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        response = {
          ok: false,
          commandId: null,
          sessionRevision: session.revision,
          error: {
            code: 'INVALID_COMMAND',
            message: 'Input line is not valid JSON.',
            details: {},
          },
        };
      }
      output.write(`${JSON.stringify(response)}\n`);
    }
  } finally {
    shutdownSignal?.removeEventListener('abort', shutdown);
    await close();
  }
}

function parseArguments(args) {
  let capacity;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument !== '--capacity') {
      throw new ResearchMemoryError(`Unknown startup option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ResearchMemoryError(`Missing value for ${argument}.`);
    }
    capacity = Number(value);
    index += 1;
  }
  if (capacity === undefined) {
    throw new ResearchMemoryError('The --capacity <1-1000> option is required.');
  }
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000) {
    throw new ResearchMemoryError('--capacity must be an integer from 1 to 1000.');
  }
  return { capacity };
}
