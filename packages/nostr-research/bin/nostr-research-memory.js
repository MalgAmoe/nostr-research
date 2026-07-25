#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  acquireRelayEvents,
  DEFAULT_ACQUISITION_EVENT_LIMIT,
  DEFAULT_ACQUISITION_TIMEOUT_MS,
  openResearchMemory,
  ResearchMemoryError,
} from '@nostr-research/memory';

const HELP = `Usage: nostr-research-memory --db <path> <command> [options]

Commands:
  init                         Create or open a SQLite research-memory file.
  reset                        Explicitly discard all stored evidence and provenance.
  import-fixture [options]     Ingest the reproducible fixture events.
  acquire [options]            Acquire valid events from explicit NIP-01 relays.
  inspect <event-id>           Print one event with its observations.
  summary                      Print public storage counts.

import-fixture options:
  --relay <url>                Relay recorded for each fixture (default: wss://fixture.example).
  --observed-at <ISO-8601>     Timestamp recorded for each fixture (default: now).

acquire options:
  --relay <wss-url>            Relay to contact; repeat for multiple relays (required).
  --filter-json <JSON>         Nostr filter supplied as JSON text.
  --filter-file <path>         Nostr filter read from an explicitly named JSON file.
  --timeout-ms <integer>       Operation timeout (default: ${DEFAULT_ACQUISITION_TIMEOUT_MS}).
  --event-limit <integer>      Global accepted-event limit (default: ${DEFAULT_ACQUISITION_EVENT_LIMIT}).

Examples:
  nostr-research-memory --db ./research.sqlite init
  nostr-research-memory --db ./research.sqlite import-fixture --relay wss://relay.example
  nostr-research-memory --db ./research.sqlite acquire --relay wss://relay.example --filter-json '{"kinds":[1],"limit":10}'
  nostr-research-memory --db ./research.sqlite summary
`;

function parseArguments(args) {
  const options = { relays: [], providedOptions: new Set() };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if ([
      '--db', '--relay', '--observed-at', '--filter-json', '--filter-file',
      '--timeout-ms', '--event-limit',
    ].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new ResearchMemoryError(`Missing value for ${argument}.`);
      options.providedOptions.add(argument);
      if (argument === '--relay') options.relays.push(value);
      else options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
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

async function main() {
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
        requireOnlyOptions(parsed, ['--db']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        print({ database: parsed.db, ...memory.summary() });
        return;
      case 'reset':
        requireOnlyOptions(parsed, ['--db']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        memory.reset();
        print({ database: parsed.db, reset: true, ...memory.summary() });
        return;
      case 'import-fixture':
        requireOnlyOptions(parsed, ['--db', '--relay', '--observed-at']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        if (parsed.relays.length > 1) throw new ResearchMemoryError('import-fixture accepts at most one --relay.');
        const fixtureRelay = parsed.relays[0] ?? 'wss://fixture.example';
        const imports = memory.importFixtures({ relay: fixtureRelay, observedAt: parsed.observedAt });
        print({
          database: parsed.db,
          imported: imports.length,
          relay: fixtureRelay,
          ...memory.summary(),
        });
        return;
      case 'acquire':
        requireOnlyOptions(parsed, [
          '--db', '--relay', '--filter-json', '--filter-file', '--timeout-ms', '--event-limit',
        ]);
        requireNoArguments(parsed.command, parsed.commandArguments);
        if ((parsed.filterJson === undefined) === (parsed.filterFile === undefined)) {
          throw new ResearchMemoryError('acquire requires exactly one of --filter-json or --filter-file.');
        }
        const filterText = parsed.filterJson ?? readFilterFile(parsed.filterFile);
        let filter;
        try {
          filter = JSON.parse(filterText);
        } catch (error) {
          throw new ResearchMemoryError(`Malformed filter JSON: ${error.message}`);
        }
        const result = await acquireRelayEvents(memory, {
          relays: parsed.relays,
          filter,
          timeoutMs: parseIntegerOption(parsed.timeoutMs, 'timeout-ms'),
          eventLimit: parseIntegerOption(parsed.eventLimit, 'event-limit'),
        });
        print({ database: parsed.db, ...result });
        return;
      case 'inspect':
        requireOnlyOptions(parsed, ['--db']);
        if (parsed.commandArguments.length !== 1) {
          throw new ResearchMemoryError('inspect requires exactly one event ID.');
        }
        const record = memory.getEvent(parsed.commandArguments[0]);
        if (!record) throw new ResearchMemoryError(`No event found for ID ${parsed.commandArguments[0]}.`);
        print(record);
        return;
      case 'summary':
        requireOnlyOptions(parsed, ['--db']);
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

function readFilterFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new ResearchMemoryError(`Cannot read filter file ${path}: ${error.message}`);
  }
}

function parseIntegerOption(value, name) {
  if (value === undefined) return undefined;
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ResearchMemoryError(`--${name} must be a positive integer.`);
  }
  return Number(value);
}

function requireNoArguments(command, arguments_) {
  if (arguments_.length > 0) {
    throw new ResearchMemoryError(`${command} does not accept positional arguments.`);
  }
}

function requireOnlyOptions(parsed, allowed) {
  for (const option of parsed.providedOptions) {
    if (!allowed.includes(option)) {
      throw new ResearchMemoryError(`${parsed.command} does not accept ${option}.`);
    }
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
