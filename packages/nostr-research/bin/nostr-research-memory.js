#!/usr/bin/env node
import { openResearchMemory, ResearchMemoryError } from '@nostr-research/memory';

const HELP = `Usage: nostr-research-memory --db <path> <command> [options]

Commands:
  init                         Create or open a SQLite research-memory file.
  reset                        Explicitly discard all stored evidence and provenance.
  import-fixture [options]     Ingest the reproducible fixture events.
  inspect <event-id>           Print one event with its observations.
  summary                      Print public storage counts.

import-fixture options:
  --relay <url>                Relay recorded for each fixture (default: wss://fixture.example).
  --observed-at <ISO-8601>     Timestamp recorded for each fixture (default: now).

Examples:
  nostr-research-memory --db ./research.sqlite init
  nostr-research-memory --db ./research.sqlite import-fixture --relay wss://relay.example
  nostr-research-memory --db ./research.sqlite summary
`;

function parseArguments(args) {
  const options = { relay: 'wss://fixture.example' };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--db' || argument === '--relay' || argument === '--observed-at') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new ResearchMemoryError(`Missing value for ${argument}.`);
      options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new ResearchMemoryError(`Unknown option: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }

  const [command, ...commandArguments] = positionals;
  return { ...options, command, commandArguments };
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.help || !parsed.command) {
    process.stdout.write(HELP);
    return;
  }
  if (!parsed.db) throw new ResearchMemoryError('The --db <path> option is required.');

  const memory = openResearchMemory(parsed.db);
  try {
    switch (parsed.command) {
      case 'init':
        requireNoArguments(parsed.command, parsed.commandArguments);
        print({ database: parsed.db, ...memory.summary() });
        return;
      case 'reset':
        requireNoArguments(parsed.command, parsed.commandArguments);
        memory.reset();
        print({ database: parsed.db, reset: true, ...memory.summary() });
        return;
      case 'import-fixture':
        requireNoArguments(parsed.command, parsed.commandArguments);
        const imports = memory.importFixtures({ relay: parsed.relay, observedAt: parsed.observedAt });
        print({
          database: parsed.db,
          imported: imports.length,
          relay: parsed.relay,
          ...memory.summary(),
        });
        return;
      case 'inspect':
        if (parsed.commandArguments.length !== 1) {
          throw new ResearchMemoryError('inspect requires exactly one event ID.');
        }
        const record = memory.getEvent(parsed.commandArguments[0]);
        if (!record) throw new ResearchMemoryError(`No event found for ID ${parsed.commandArguments[0]}.`);
        print(record);
        return;
      case 'summary':
        requireNoArguments(parsed.command, parsed.commandArguments);
        print({ database: parsed.db, ...memory.summary() });
        return;
      default:
        throw new ResearchMemoryError(`Unknown command: ${parsed.command}. Run with --help for usage.`);
    }
  } finally {
    memory.close();
  }
}

function requireNoArguments(command, arguments_) {
  if (arguments_.length > 0) {
    throw new ResearchMemoryError(`${command} does not accept positional arguments.`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
