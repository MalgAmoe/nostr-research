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
  search [options]             Search accumulated local events (never relays).
  accounts [options]           Search current stored account metadata.
  account <pubkey-or-prefix>   Resolve current metadata for one stored account.
  related event <id-or-prefix> Show inbound and outbound event relationships.
  related account <key-prefix> Show authored events and account references.
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

search options:
  --id <id-or-prefix>          Event ID constraint; repeat for OR.
  --author <key-or-prefix>     Author constraint; repeat for OR.
  --kind <integer>             Event kind constraint; repeat for OR.
  --since <unix-seconds>       Inclusive lower creation-time bound.
  --until <unix-seconds>       Inclusive upper creation-time bound.
  --tag <name=value>           Exact tag constraint (e.g. e=<id>, p=<key>, t=nostr).
  --text <term>                Case-insensitive content term; repeat for AND.
  --limit <integer>            Result limit (default: 50, maximum: 1000).
  --order <newest|oldest>      Deterministic creation-time order.

accounts options:
  --pubkey <key-or-prefix>     Public-key constraint; repeat for OR.
  --text <term>                Profile-field term; repeat for AND.
  --limit <integer>            Result limit (default: 50, maximum: 1000).

Examples:
  nostr-research-memory --db ./research.sqlite init
  nostr-research-memory --db ./research.sqlite import-fixture --relay wss://relay.example
  nostr-research-memory --db ./research.sqlite acquire --relay wss://relay.example --filter-json '{"kinds":[1],"limit":10}'
  nostr-research-memory --db ./research.sqlite summary
`;

function parseArguments(args) {
  const options = {
    relays: [], ids: [], authors: [], kinds: [], tags: [], texts: [], publicKeys: [],
    providedOptions: new Set(),
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if ([
      '--db', '--relay', '--observed-at', '--filter-json', '--filter-file',
      '--timeout-ms', '--event-limit', '--id', '--author', '--kind', '--since',
      '--until', '--tag', '--text', '--limit', '--order', '--pubkey',
    ].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new ResearchMemoryError(`Missing value for ${argument}.`);
      options.providedOptions.add(argument);
      if (argument === '--relay') options.relays.push(value);
      else if (argument === '--id') options.ids.push(value);
      else if (argument === '--author') options.authors.push(value);
      else if (argument === '--kind') options.kinds.push(value);
      else if (argument === '--tag') options.tags.push(value);
      else if (argument === '--text') options.texts.push(value);
      else if (argument === '--pubkey') options.publicKeys.push(value);
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
      case 'search':
        requireOnlyOptions(parsed, [
          '--db', '--id', '--author', '--kind', '--since', '--until', '--tag',
          '--text', '--limit', '--order',
        ]);
        requireNoArguments(parsed.command, parsed.commandArguments);
        print({
          database: parsed.db,
          ...memory.searchEvents({
            ...(parsed.ids.length ? { ids: parsed.ids } : {}),
            ...(parsed.authors.length ? { authors: parsed.authors } : {}),
            ...(parsed.kinds.length ? { kinds: parsed.kinds.map((kind) => parseNonNegativeInteger(kind, 'kind')) } : {}),
            ...(parsed.since !== undefined ? { since: parseNonNegativeInteger(parsed.since, 'since') } : {}),
            ...(parsed.until !== undefined ? { until: parseNonNegativeInteger(parsed.until, 'until') } : {}),
            ...(parsed.tags.length ? { tags: parseTags(parsed.tags) } : {}),
            ...(parsed.texts.length ? { text: parsed.texts } : {}),
            ...(parsed.limit !== undefined ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
            ...(parsed.order !== undefined ? { order: parsed.order } : {}),
          }),
        });
        return;
      case 'accounts':
        requireOnlyOptions(parsed, ['--db', '--pubkey', '--text', '--limit']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        print({
          database: parsed.db,
          ...memory.searchAccounts({
            ...(parsed.publicKeys.length ? { publicKeys: parsed.publicKeys } : {}),
            ...(parsed.texts.length ? { text: parsed.texts } : {}),
            ...(parsed.limit !== undefined ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
          }),
        });
        return;
      case 'account':
        requireOnlyOptions(parsed, ['--db']);
        if (parsed.commandArguments.length !== 1) {
          throw new ResearchMemoryError('account requires exactly one public key or unambiguous prefix.');
        }
        print(memory.resolveAccount(parsed.commandArguments[0]));
        return;
      case 'related':
        requireOnlyOptions(parsed, ['--db']);
        if (parsed.commandArguments.length !== 2 || !['event', 'account'].includes(parsed.commandArguments[0])) {
          throw new ResearchMemoryError('related requires "event <id-or-prefix>" or "account <key-or-prefix>".');
        }
        print(parsed.commandArguments[0] === 'event'
          ? memory.relatedEvent(parsed.commandArguments[1])
          : memory.relatedAccount(parsed.commandArguments[1]));
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

function parseNonNegativeInteger(value, name) {
  if (!/^(0|[1-9][0-9]*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ResearchMemoryError(`--${name} must be a non-negative integer.`);
  }
  return Number(value);
}

function parseTags(values) {
  const tags = {};
  for (const value of values) {
    const separator = value.indexOf('=');
    if (separator < 1 || separator === value.length - 1) {
      throw new ResearchMemoryError('--tag must use name=value with a non-empty name and value.');
    }
    const name = value.slice(0, separator);
    (tags[name] ??= []).push(value.slice(separator + 1));
  }
  return tags;
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
