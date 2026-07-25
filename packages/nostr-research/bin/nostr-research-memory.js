#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  acquireRelayEvents,
  DEFAULT_ACQUISITION_EVENT_LIMIT,
  DEFAULT_ACQUISITION_TIMEOUT_MS,
  openResearchMemory,
  ResearchMemoryError,
} from '@nostr-research/memory';

const HELP = `Usage: nostr-research-memory --db <path> [--output <mode>] <command> [options]

Global options (accepted before or after the command):
  --db <path>                  SQLite research-memory file (required).
  --output <mode>              compact, full, ids, or ndjson.
                               Result/list commands default to compact; evidence
                               inspection commands default to full.

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
  run search [search options]   Search local events and record the completed run.
  run accounts [options]       Search local accounts and record the completed run.
  run list                     List immutable recorded research runs.
  run inspect <run-id>         Inspect one recorded research run.
  set create <name>            Create a durable named research set.
  set list                     List saved sets without expanding members by default.
  set inspect <set-id>         Inspect one saved set.
  set rename <set-id> <name>   Rename a set without changing its identity.
  set delete <set-id>          Delete a set.
  set add <set> <type> <id>    Add an event or account member.
  set remove <set> <type> <id> Remove a member.
  set from-run <name> <run-id> Create a set from recorded results.
  set expand <set> <name>      Expand through selected local relationships.
  set combine <op> <a> <b> <name>
                               Create union, intersection, or difference.
  set explain <set> <type> <id>
                               Explain one event or account membership.
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
  --record                     Persist the acquisition outcome as a research run.

set options:
  --reason-json <JSON>         Explicit membership reason (default: {"type":"explicit"}).
  --relationship <type>        Relationship type for expansion; repeatable.
  --direction <value>          outbound, inbound, or both (default: outbound).
  --limit <integer>            Maximum distinct expansion members (default: 50).

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
    relationships: [],
    providedOptions: new Set(),
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--record') {
      options.record = true;
      options.providedOptions.add(argument);
      continue;
    }
    if ([
      '--db', '--relay', '--observed-at', '--filter-json', '--filter-file',
      '--timeout-ms', '--event-limit', '--id', '--author', '--kind', '--since',
      '--until', '--tag', '--text', '--limit', '--order', '--pubkey',
      '--reason-json', '--relationship', '--direction', '--output',
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
      else if (argument === '--relationship') options.relationships.push(value);
      else options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else if (argument.startsWith('--')) {
      throw new ResearchMemoryError(`Unknown option: ${argument}`);
    } else {
      positionals.push(argument);
    }
  }

  const [command, ...commandArguments] = positionals;
  if (options.output !== undefined && !['compact', 'full', 'ids', 'ndjson'].includes(options.output)) {
    throw new ResearchMemoryError(
      `Unsupported --output mode "${options.output}". Use compact, full, ids, or ndjson.`,
    );
  }
  return { ...options, command, commandArguments };
}

function print(value, mode = 'full', records = []) {
  if (mode === 'ndjson') {
    process.stdout.write(records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''));
    return;
  }
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
        requireOnlyOptions(parsed, ['--db', '--output']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        printGeneric({ database: parsed.db, ...memory.summary() }, parsed);
        return;
      case 'reset':
        requireOnlyOptions(parsed, ['--db', '--output']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        memory.reset();
        printGeneric({ database: parsed.db, reset: true, ...memory.summary() }, parsed);
        return;
      case 'import-fixture':
        requireOnlyOptions(parsed, ['--db', '--relay', '--observed-at', '--output']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        if (parsed.relays.length > 1) throw new ResearchMemoryError('import-fixture accepts at most one --relay.');
        const fixtureRelay = parsed.relays[0] ?? 'wss://fixture.example';
        const imports = memory.importFixtures({ relay: fixtureRelay, observedAt: parsed.observedAt });
        printGeneric({
          database: parsed.db,
          imported: imports.length,
          relay: fixtureRelay,
          ...memory.summary(),
        }, parsed);
        return;
      case 'acquire':
        requireOnlyOptions(parsed, [
          '--db', '--relay', '--filter-json', '--filter-file', '--timeout-ms', '--event-limit',
          '--record', '--output',
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
        const acquisitionInputs = {
          relays: parsed.relays,
          filter,
          timeoutMs: parseIntegerOption(parsed.timeoutMs, 'timeout-ms')
            ?? DEFAULT_ACQUISITION_TIMEOUT_MS,
          eventLimit: parseIntegerOption(parsed.eventLimit, 'event-limit')
            ?? DEFAULT_ACQUISITION_EVENT_LIMIT,
        };
        const result = await acquireRelayEvents(memory, acquisitionInputs);
        const recordedAcquisition = parsed.record ? memory.recordRun({
          operation: 'acquisition',
          inputs: {
            ...result.requested,
            timeoutMs: acquisitionInputs.timeoutMs,
            eventLimit: acquisitionInputs.eventLimit,
          },
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          status: result.completionReason,
          diagnostics: result.relays.map(({ relay, outcome, diagnostic }) => ({
            relay, outcome, ...(diagnostic ? { diagnostic } : {}),
          })),
          results: result.acquiredEventIds.map((id) => {
            const acquired = result.acquiredObservations.find(({ eventId }) => eventId === id);
            return {
              type: 'event', id, reasons: [{ type: 'acquired' }],
              provenance: acquired?.observations ?? [],
            };
          }),
        }) : undefined;
        printAcquisition(parsed.db, result, recordedAcquisition, parsed.output ?? 'compact');
        return;
      case 'inspect':
        requireOnlyOptions(parsed, ['--db', '--output']);
        if (parsed.commandArguments.length !== 1) {
          throw new ResearchMemoryError('inspect requires exactly one event ID.');
        }
        const record = memory.getEvent(parsed.commandArguments[0]);
        if (!record) throw new ResearchMemoryError(`No event found for ID ${parsed.commandArguments[0]}.`);
        printInspection(record, parsed.output ?? 'full', {
          compact: { type: 'event', id: record.event.id },
          ids: [record.event.id],
        });
        return;
      case 'search':
        requireOnlyOptions(parsed, [
          '--db', '--id', '--author', '--kind', '--since', '--until', '--tag',
          '--text', '--limit', '--order', '--output',
        ]);
        requireNoArguments(parsed.command, parsed.commandArguments);
        printEventSearch(parsed.db, memory.searchEvents({
            ...(parsed.ids.length ? { ids: parsed.ids } : {}),
            ...(parsed.authors.length ? { authors: parsed.authors } : {}),
            ...(parsed.kinds.length ? { kinds: parsed.kinds.map((kind) => parseNonNegativeInteger(kind, 'kind')) } : {}),
            ...(parsed.since !== undefined ? { since: parseNonNegativeInteger(parsed.since, 'since') } : {}),
            ...(parsed.until !== undefined ? { until: parseNonNegativeInteger(parsed.until, 'until') } : {}),
            ...(parsed.tags.length ? { tags: parseTags(parsed.tags) } : {}),
            ...(parsed.texts.length ? { text: parsed.texts } : {}),
            ...(parsed.limit !== undefined ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
            ...(parsed.order !== undefined ? { order: parsed.order } : {}),
          }), parsed.output ?? 'compact');
        return;
      case 'accounts':
        requireOnlyOptions(parsed, ['--db', '--pubkey', '--text', '--limit', '--output']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        printAccountSearch(parsed.db, memory.searchAccounts({
            ...(parsed.publicKeys.length ? { publicKeys: parsed.publicKeys } : {}),
            ...(parsed.texts.length ? { text: parsed.texts } : {}),
            ...(parsed.limit !== undefined ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
          }), parsed.output ?? 'compact');
        return;
      case 'account':
        requireOnlyOptions(parsed, ['--db', '--output']);
        if (parsed.commandArguments.length !== 1) {
          throw new ResearchMemoryError('account requires exactly one public key or unambiguous prefix.');
        }
        const account = memory.resolveAccount(parsed.commandArguments[0]);
        printInspection(account, parsed.output ?? 'full', {
          compact: { type: 'account', id: account.publicKey },
          ids: [account.publicKey],
        });
        return;
      case 'related':
        requireOnlyOptions(parsed, ['--db', '--output']);
        if (parsed.commandArguments.length !== 2 || !['event', 'account'].includes(parsed.commandArguments[0])) {
          throw new ResearchMemoryError('related requires "event <id-or-prefix>" or "account <key-or-prefix>".');
        }
        printRelationships(parsed.commandArguments[0] === 'event'
          ? memory.relatedEvent(parsed.commandArguments[1])
          : memory.relatedAccount(parsed.commandArguments[1]), parsed.output ?? 'compact');
        return;
      case 'run':
        await handleRunCommand(memory, parsed);
        return;
      case 'set':
        handleSetCommand(memory, parsed);
        return;
      case 'summary':
        requireOnlyOptions(parsed, ['--db', '--output']);
        requireNoArguments(parsed.command, parsed.commandArguments);
        printGeneric({ database: parsed.db, ...memory.summary() }, parsed);
        return;
      default:
        throw new ResearchMemoryError(`Unknown command: ${parsed.command}. Run with --help for usage.`);
    }
  } finally {
    memory.close();
  }
}

function handleRunCommand(memory, parsed) {
  const [subcommand, ...arguments_] = parsed.commandArguments;
  if (subcommand === 'list') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    requireNoArguments('run list', arguments_);
    printRunList(memory.listRuns(), parsed.output ?? 'compact');
    return;
  }
  if (subcommand === 'inspect') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 1) throw new ResearchMemoryError('run inspect requires one run ID.');
    const run = memory.getRun(arguments_[0]);
    printInspection(run, parsed.output ?? 'full', {
      compact: compactRun(run),
      ids: run.results.map(({ type, id }) => ({ type, id })),
    });
    return;
  }
  if (subcommand === 'search') {
    requireOnlyOptions(parsed, [
      '--db', '--id', '--author', '--kind', '--since', '--until', '--tag',
      '--text', '--limit', '--order', '--output',
    ]);
    requireNoArguments('run search', arguments_);
    const startedAt = new Date().toISOString();
    const outcome = memory.searchEvents(eventQueryFromArguments(parsed));
    printRunAcknowledgement(memory.recordRun({
      operation: 'event-query',
      inputs: outcome.query,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'completed',
      diagnostics: [],
      results: outcome.results.map(({ event, observations, matchReasons }) => ({
        type: 'event', id: event.id, reasons: matchReasons, provenance: observations,
      })),
    }), parsed.output ?? 'compact');
    return;
  }
  if (subcommand === 'accounts') {
    requireOnlyOptions(parsed, ['--db', '--pubkey', '--text', '--limit', '--output']);
    requireNoArguments('run accounts', arguments_);
    const startedAt = new Date().toISOString();
    const outcome = memory.searchAccounts(accountQueryFromArguments(parsed));
    printRunAcknowledgement(memory.recordRun({
      operation: 'account-query',
      inputs: outcome.query,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'completed',
      diagnostics: [],
      results: outcome.results.map(({ publicKey, observations, matchReasons }) => ({
        type: 'account', id: publicKey, reasons: matchReasons, provenance: observations,
      })),
    }), parsed.output ?? 'compact');
    return;
  }
  throw new ResearchMemoryError(
    'run requires "search", "accounts", "list", or "inspect".',
  );
}

function handleSetCommand(memory, parsed) {
  const [subcommand, ...arguments_] = parsed.commandArguments;
  if (subcommand === 'create') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 1) throw new ResearchMemoryError('set create requires one name.');
    printSetAcknowledgement(memory.createSet(arguments_[0]), parsed.output ?? 'compact');
  } else if (subcommand === 'list') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    requireNoArguments('set list', arguments_);
    printSetList(memory.listSets(), parsed.output ?? 'compact');
  } else if (subcommand === 'inspect') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 1) throw new ResearchMemoryError('set inspect requires one set ID.');
    const set = memory.getSet(arguments_[0]);
    printInspection(set, parsed.output ?? 'full', {
      compact: compactSet(set),
      ids: set.members.map(({ type, id }) => ({ type, id })),
    });
  } else if (subcommand === 'rename') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 2) throw new ResearchMemoryError('set rename requires a set ID and name.');
    printSetAcknowledgement(memory.renameSet(arguments_[0], arguments_[1]), parsed.output ?? 'compact');
  } else if (subcommand === 'delete') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 1) throw new ResearchMemoryError('set delete requires one set ID.');
    printGeneric(memory.deleteSet(arguments_[0]), parsed, 'compact', [{ type: 'set', id: arguments_[0] }]);
  } else if (subcommand === 'add') {
    requireOnlyOptions(parsed, ['--db', '--reason-json', '--output']);
    if (arguments_.length !== 3) {
      throw new ResearchMemoryError('set add requires a set ID, entity type, and full entity ID.');
    }
    const added = memory.addSetMember(
      arguments_[0],
      { type: arguments_[1], id: arguments_[2] },
      parsed.reasonJson ? parseJsonOption(parsed.reasonJson, 'reason-json') : { type: 'explicit' },
    );
    if ((parsed.output ?? 'compact') === 'full') print(added);
    else printSetAcknowledgement(memory.getSet(arguments_[0]), parsed.output ?? 'compact');
  } else if (subcommand === 'remove') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 3) {
      throw new ResearchMemoryError('set remove requires a set ID, entity type, and full entity ID.');
    }
    const removed = memory.removeSetMember(arguments_[0], { type: arguments_[1], id: arguments_[2] });
    if ((parsed.output ?? 'compact') === 'full') print(removed);
    else printSetAcknowledgement(memory.getSet(arguments_[0]), parsed.output ?? 'compact', { removed });
  } else if (subcommand === 'from-run') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 2) throw new ResearchMemoryError('set from-run requires a name and run ID.');
    printSetAcknowledgement(memory.createSetFromRun(arguments_[0], arguments_[1]), parsed.output ?? 'compact');
  } else if (subcommand === 'expand') {
    requireOnlyOptions(parsed, ['--db', '--relationship', '--direction', '--limit', '--output']);
    if (arguments_.length !== 2 || parsed.relationships.length === 0) {
      throw new ResearchMemoryError(
        'set expand requires a source set ID, new name, and at least one --relationship.',
      );
    }
    printSetAcknowledgement(memory.expandSet(arguments_[0], arguments_[1], {
      relationshipTypes: parsed.relationships,
      ...(parsed.direction ? { direction: parsed.direction } : {}),
      ...(parsed.limit ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
    }), parsed.output ?? 'compact');
  } else if (subcommand === 'combine') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 4) {
      throw new ResearchMemoryError(
        'set combine requires an operation, left set ID, right set ID, and new name.',
      );
    }
    printSetAcknowledgement(
      memory.combineSets(arguments_[0], arguments_[1], arguments_[2], arguments_[3]),
      parsed.output ?? 'compact',
    );
  } else if (subcommand === 'explain') {
    requireOnlyOptions(parsed, ['--db', '--output']);
    if (arguments_.length !== 3) {
      throw new ResearchMemoryError('set explain requires a set ID, entity type, and entity ID.');
    }
    const explanation = memory.explainSetMember(
      arguments_[0], { type: arguments_[1], id: arguments_[2] },
    );
    printInspection(
      explanation, parsed.output ?? 'full',
      {
        compact: {
          set: explanation.set,
          member: { type: explanation.member.type, id: explanation.member.id },
        },
        ids: [{ type: explanation.member.type, id: explanation.member.id }],
      },
    );
  } else {
    throw new ResearchMemoryError(
      'set requires create, list, inspect, rename, delete, add, remove, from-run, expand, combine, or explain.',
    );
  }
}

function printAcquisition(database, result, run, mode) {
  const full = { database, ...result, ...(run ? { run } : {}) };
  const compact = {
    database,
    completionReason: result.completionReason,
    ...(run ? { runId: run.id } : {}),
    counts: result.counts,
    relays: result.relays.map(({ relay, outcome, diagnostic }) => ({
      relay, outcome, ...(diagnostic ? { diagnostic } : {}),
    })),
    acquiredEventIds: result.acquiredEventIds,
  };
  const ids = result.acquiredEventIds;
  print(mode === 'full' ? full : mode === 'ids' ? ids : compact, mode, [
    { type: 'acquisition', ...compact },
  ]);
}

function printEventSearch(database, outcome, mode) {
  const results = outcome.results.map(({ event, observations, matchReasons }) => ({
    id: event.id,
    kind: event.kind,
    author: event.pubkey,
    createdAt: event.created_at,
    contentExcerpt: excerpt(event.content),
    relays: distinctRelays(observations),
    matchReasons,
  }));
  if (mode === 'full') return print({ database, ...outcome });
  if (mode === 'ids') return print(results.map(({ id }) => id));
  if (mode === 'ndjson') {
    return print(null, mode, [
      { type: 'query', entityType: 'event', database, query: outcome.query, resultCount: results.length },
      ...results.map((result) => ({ type: 'event', ...result })),
    ]);
  }
  print({ database, query: outcome.query, results });
}

function printAccountSearch(database, outcome, mode) {
  const results = outcome.results.map((result) => ({
    publicKey: result.publicKey,
    name: result.profile.name,
    displayName: result.profile.display_name,
    metadataEventId: result.metadataEvent.id,
    relays: distinctRelays(result.observations),
    matchReasons: result.matchReasons,
  }));
  if (mode === 'full') return print({ database, ...outcome });
  if (mode === 'ids') return print(results.map(({ publicKey }) => publicKey));
  if (mode === 'ndjson') {
    return print(null, mode, [
      { type: 'query', entityType: 'account', database, query: outcome.query, resultCount: results.length },
      ...results.map((result) => ({ type: 'account', ...result })),
    ]);
  }
  print({ database, query: outcome.query, results });
}

function printRelationships(navigation, mode) {
  const compact = {
    subject: { type: navigation.subject.type, id: navigation.subject.id },
    relationships: navigation.relationships.map((relationship) => ({
      direction: relationship.direction,
      type: relationship.type,
      target: relationship.target,
      sourceEventId: relationship.sourceEventId,
      evidence: relationship.evidence,
    })),
  };
  if (mode === 'full') return print(navigation);
  if (mode === 'ids') {
    const identifiers = [
      { type: compact.subject.type, id: compact.subject.id },
      ...compact.relationships.map(({ target }) => ({ type: target.type, id: target.id })),
    ];
    return print(uniqueIdentifiers(identifiers));
  }
  if (mode === 'ndjson') {
    return print(null, mode, [
      { type: 'subject', ...compact.subject },
      ...compact.relationships.map((relationship) => ({ recordType: 'relationship', ...relationship })),
    ]);
  }
  print(compact);
}

function printRunList(runs, mode) {
  const compact = runs.map(compactRun);
  if (mode === 'full') return print({ runs });
  if (mode === 'ids') return print(compact.map(({ id }) => id));
  if (mode === 'ndjson') return print(null, mode, compact.map((run) => ({ type: 'run', ...run })));
  print({ runs: compact });
}

function printRunAcknowledgement(run, mode) {
  if (mode === 'full') return print(run);
  if (mode === 'ids') return print([run.id]);
  const compact = compactRun(run);
  print(mode === 'ndjson' ? null : compact, mode, [{ type: 'run', ...compact }]);
}

function compactRun(run) {
  return {
    id: run.id,
    operation: run.operation,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    resultCount: run.results.length,
    diagnosticCount: run.diagnostics.length,
  };
}

function printSetList(sets, mode) {
  const compact = sets.map(compactSet);
  if (mode === 'full') return print({ sets });
  if (mode === 'ids') return print(compact.map(({ id }) => id));
  if (mode === 'ndjson') return print(null, mode, compact.map((set) => ({ type: 'set', ...set })));
  print({ sets: compact });
}

function printSetAcknowledgement(set, mode, extra = {}) {
  if (mode === 'full') return print(set);
  if (mode === 'ids') return print([set.id]);
  const compact = { ...compactSet(set), ...extra };
  print(mode === 'ndjson' ? null : compact, mode, [{ type: 'set', ...compact }]);
}

function compactSet(set) {
  return {
    id: set.id,
    name: set.name,
    createdAt: set.createdAt,
    memberCount: set.members.length,
    eventCount: set.members.filter(({ type }) => type === 'event').length,
    accountCount: set.members.filter(({ type }) => type === 'account').length,
  };
}

function printInspection(full, mode, { compact, ids }) {
  if (mode === 'full') return print(full);
  if (mode === 'ids') return print(ids);
  print(mode === 'ndjson' ? null : compact, mode, [compact]);
}

function printGeneric(value, parsed, defaultMode = 'full', identifiers = []) {
  const mode = parsed.output ?? defaultMode;
  if (mode === 'ids') return print(identifiers.map(({ type, id }) => ({ type, id })));
  print(mode === 'ndjson' ? null : value, mode, [{ type: parsed.command, ...value }]);
}

function excerpt(content, maximum = 160) {
  const singleLine = content.replace(/\s+/gu, ' ').trim();
  return singleLine.length <= maximum ? singleLine : `${singleLine.slice(0, maximum - 1)}…`;
}

function distinctRelays(observations) {
  return [...new Set(observations.map(({ relay }) => relay))].sort();
}

function uniqueIdentifiers(identifiers) {
  const seen = new Set();
  return identifiers.filter(({ type, id }) => {
    const key = `${type}:${id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventQueryFromArguments(parsed) {
  return {
    ...(parsed.ids.length ? { ids: parsed.ids } : {}),
    ...(parsed.authors.length ? { authors: parsed.authors } : {}),
    ...(parsed.kinds.length ? { kinds: parsed.kinds.map((kind) => parseNonNegativeInteger(kind, 'kind')) } : {}),
    ...(parsed.since !== undefined ? { since: parseNonNegativeInteger(parsed.since, 'since') } : {}),
    ...(parsed.until !== undefined ? { until: parseNonNegativeInteger(parsed.until, 'until') } : {}),
    ...(parsed.tags.length ? { tags: parseTags(parsed.tags) } : {}),
    ...(parsed.texts.length ? { text: parsed.texts } : {}),
    ...(parsed.limit !== undefined ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
    ...(parsed.order !== undefined ? { order: parsed.order } : {}),
  };
}

function accountQueryFromArguments(parsed) {
  return {
    ...(parsed.publicKeys.length ? { publicKeys: parsed.publicKeys } : {}),
    ...(parsed.texts.length ? { text: parsed.texts } : {}),
    ...(parsed.limit !== undefined ? { limit: parseIntegerOption(parsed.limit, 'limit') } : {}),
  };
}

function parseJsonOption(value, name) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ResearchMemoryError(`Malformed --${name} JSON: ${error.message}`);
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
