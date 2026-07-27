import { createInterface } from 'node:readline';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  RESEARCH_CONSTRAINTS,
  ResearchMemoryError,
} from './index.js';

const CAPACITY_RANGE = `${RESEARCH_CONSTRAINTS.memory.capacity.minimum}-`
  + `${RESEARCH_CONSTRAINTS.memory.capacity.maximum}`;
const HELP = `Usage: nostr-research-session --capacity <${CAPACITY_RANGE}> [options]

Options:
  --archive-capacity <${CAPACITY_RANGE}>
  --notebook-capacity <${RESEARCH_CONSTRAINTS.notebook.capacity.minimum}-${RESEARCH_CONSTRAINTS.notebook.capacity.maximum}>

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
  const memory = createInMemoryResearchMemory({
    capacity: options.capacity,
    ...(options.archiveCapacity === undefined
      ? {} : { archiveCapacity: options.archiveCapacity }),
    ...(options.notebookCapacity === undefined
      ? {} : { notebookCapacity: options.notebookCapacity }),
  });
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
  const options = {};
  const names = {
    '--capacity': 'capacity',
    '--archive-capacity': 'archiveCapacity',
    '--notebook-capacity': 'notebookCapacity',
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (!names[argument]) {
      throw new ResearchMemoryError(`Unknown startup option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ResearchMemoryError(`Missing value for ${argument}.`);
    }
    options[names[argument]] = Number(value);
    index += 1;
  }
  if (options.capacity === undefined) {
    throw new ResearchMemoryError(
      `The --capacity <${CAPACITY_RANGE}> option is required.`,
    );
  }
  for (const [name, value] of Object.entries(options)) {
    const constraint = name === 'notebookCapacity'
      ? RESEARCH_CONSTRAINTS.notebook.capacity
      : RESEARCH_CONSTRAINTS.memory.capacity;
    if (!Number.isSafeInteger(value)
        || value < constraint.minimum || value > constraint.maximum) {
      throw new ResearchMemoryError(
        `${name} must be an integer from ${constraint.minimum} to ${constraint.maximum}.`,
      );
    }
  }
  return options;
}
