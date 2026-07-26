import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  acquireRelayEvents,
  createInMemoryResearchMemory,
  createDeclarativeResearchSession,
  executeResearchPlan,
  hydrateAccounts,
  ResearchMemoryError,
  subject,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const loopbackAvailable = await supportsLoopbackListener();

test('declarative session preserves handles, revisions, preflight, and partial outcomes', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const session = createDeclarativeResearchSession(context.memory);
  const [event] = loadFixtureEvents();
  let requests = 0;
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      requests += 1;
      send(['EVENT', subscriptionId, event]);
      // The observation bound deliberately ends this attempt without EOSE.
    });
  }, context.directory);

  try {
    const selected = await session.execute({
      commandId: 'select-empty',
      command: 'select',
      parameters: { scope: 'corpus', kinds: [1] },
      resultId: 'notes',
    });
    assert.deepEqual(selected, {
      ok: true,
      commandId: 'select-empty',
      sessionRevision: 1,
      result: {
        handle: {
          id: 'notes', kind: 'events', count: 0, revision: 1, scope: 'corpus',
        },
      },
      warnings: [],
    });

    const conflict = await session.execute({
      commandId: 'stale',
      ifRevision: 0,
      command: 'select',
      parameters: { scope: 'corpus' },
    });
    assert.equal(conflict.error.code, 'REVISION_CONFLICT');
    assert.equal(conflict.sessionRevision, 1);

    const duplicate = await session.execute({
      commandId: 'duplicate',
      command: 'select',
      parameters: { scope: 'corpus' },
      resultId: 'notes',
    });
    assert.equal(duplicate.error.code, 'DUPLICATE_RESULT');
    assert.equal(duplicate.sessionRevision, 1);

    const replaced = await session.execute({
      commandId: 'replace',
      ifRevision: 1,
      command: 'select',
      parameters: { scope: 'corpus' },
      resultId: 'notes',
      replace: true,
    });
    assert.equal(replaced.ok, true);
    assert.equal(replaced.sessionRevision, 2);
    assert.equal(replaced.result.handle.revision, 2);

    const invalidPlan = await session.execute({
      commandId: 'preflight',
      command: 'plan',
      plan: [
        {
          id: 'remote',
          operation: 'acquire',
          parameters: {
            relays: [relay.url], filter: {}, timeoutMs: 1_000,
            observationLimit: 1, distinctEventLimit: 1,
          },
        },
        {
          id: 'counts',
          operation: 'summarize',
          input: 'remote',
          parameters: { aggregations: [{ name: 'count', operation: 'count' }] },
        },
        {
          id: 'bad-retain',
          operation: 'retain',
          input: 'counts',
          parameters: { name: 'not subjects' },
        },
      ],
      outputs: { remote: 'remote' },
    });
    assert.equal(invalidPlan.error.code, 'TYPE_MISMATCH');
    assert.equal(invalidPlan.sessionRevision, 2);
    assert.equal(requests, 0);
    assert.equal(context.memory.describe().eventCount, 0);
    assert.deepEqual(context.memory.listSets(), []);

    const emptyHydration = await session.execute({
      commandId: 'empty-hydration-after-acquire',
      ifRevision: 2,
      command: 'plan',
      plan: [
        {
          id: 'remote',
          operation: 'acquire',
          parameters: {
            relays: [relay.url], filter: { kinds: [event.kind] }, timeoutMs: 1_000,
            observationLimit: 1, distinctEventLimit: 2,
          },
        },
        {
          id: 'empty-events',
          operation: 'select',
          input: 'remote',
          parameters: { kinds: [999_999] },
        },
        {
          id: 'empty-accounts',
          operation: 'move',
          input: 'empty-events',
          parameters: { to: 'authors' },
        },
        {
          id: 'profiles',
          operation: 'hydrate',
          input: 'empty-accounts',
          parameters: {
            relays: [relay.url], timeoutMs: 1_000,
            observationLimit: 1, distinctEventLimit: 1,
          },
        },
      ],
      outputs: { 'empty-accounts': 'empty-accounts' },
    });
    assert.equal(emptyHydration.ok, true);
    assert.equal(emptyHydration.sessionRevision, 3);
    assert.equal(emptyHydration.result.stages[3].external.status, 'partial');
    assert.deepEqual(
      emptyHydration.result.stages[3].external.completeness.boundsReached,
      ['no-account-subjects'],
    );
    assert.equal(context.memory.describe().eventCount, 1);

    const partial = await session.execute({
      commandId: 'partial',
      ifRevision: 3,
      command: 'acquire',
      parameters: {
        relays: [relay.url], filter: { kinds: [event.kind] }, timeoutMs: 1_000,
        observationLimit: 1, distinctEventLimit: 2,
      },
      resultId: 'acquired',
    });
    assert.equal(partial.ok, true);
    assert.equal(partial.sessionRevision, 4);
    assert.deepEqual(partial.result.handle, {
      id: 'acquired', kind: 'events', count: 1, revision: 4, scope: 'acquisition',
    });
    assert.equal(partial.result.external.status, 'partial');
    assert.deepEqual(partial.result.external.completeness.boundsReached, ['observation-budget']);
    assert.equal(partial.result.external.completeness.duplicateObservations, 0);
    assert.deepEqual(partial.result.external.completeness.relays, {
      attempted: 1,
      complete: 0,
      incomplete: 1,
      outcomes: [{ outcome: 'observation-budget', count: 1 }],
      omittedOutcomes: 0,
    });
    assert.equal(context.memory.describe().eventCount, 1);

    const unsafe = await session.execute({
      commandId: 'no-code',
      command: 'retain',
      input: 'notes',
      parameters: { name: 'x', callback: '() => process.exit()' },
    });
    assert.equal(unsafe.error.code, 'INVALID_OPERATION');
    assert.equal(unsafe.sessionRevision, 4);
  } finally {
    await session.close();
    await relay.close();
  }
});

test('public acquisition handles NIP-01 outcomes, validation, deduplication, and provenance', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const [firstEvent] = loadFixtureEvents();
  const invalidEvent = { ...firstEvent, id: '0'.repeat(64) };
  const firstRelay = await startRelay((connection) => {
    connection.onRequest((_subscriptionId, send) => {
      send(['EVENT', _subscriptionId, invalidEvent]);
      send(['EVENT', _subscriptionId, firstEvent]);
      send(['EOSE', _subscriptionId]);
    });
  }, context.directory);
  const secondRelay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      send(['EVENT', subscriptionId, firstEvent]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);

  try {
    const result = await acquireRelayEvents(context.memory, {
      relays: [firstRelay.url, secondRelay.url],
      filter: { kinds: [1], limit: 5 },
      timeoutMs: 2_000,
      observationLimit: 5,
      concurrency: 2,
    });

    assert.equal(result.completionReason, 'completed');
    assert.deepEqual(result.relays.map((relay) => relay.outcome), ['eose', 'eose']);
    assert.deepEqual(result.counts, {
      receivedPackets: 3,
      invalid: 1,
      nonMatching: 0,
      acceptedObservations: 2,
      duplicateObservations: 1,
      newlyStoredCorpusEvents: 1,
      distinctEventsAcquired: 1,
    });
    assert.deepEqual(result.acquiredEventIds, [firstEvent.id]);
    assert.deepEqual(result.coverage.requested, {
      filter: { kinds: [1], limit: 5 },
      relays: [firstRelay.url, secondRelay.url].sort(),
    });
    assert.deepEqual(result.coverage.budget, result.budget);
    assert.equal(result.coverage.completionReason, 'completed');
    assert.equal(result.coverage.exhaustive, false);
    assert.match(result.coverage.uncertainty, /not implied/);
    assert.deepEqual(
      result.coverage.observedEvents.map(({ eventId, relay }) => ({ eventId, relay })),
      [
        { eventId: firstEvent.id, relay: firstRelay.url },
        { eventId: firstEvent.id, relay: secondRelay.url },
      ],
    );
    assert.deepEqual(
      result.coverage.relays.map(({ outcome }) => outcome),
      ['eose', 'eose'],
    );
    assert.deepEqual(
      context.memory.getEvent(firstEvent.id).observations.map(({ relay }) => relay).sort(),
      [firstRelay.url, secondRelay.url].sort(),
    );
  } finally {
    await firstRelay.close();
    await secondRelay.close();
    context.close();
  }
});

test('account hydration derives a bounded metadata filter from account subjects', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const key = Uint8Array.from(Buffer.from('b'.repeat(64), 'hex'));
  const publicKey = getPublicKey(key);
  const metadata = finalizeEvent({
    kind: 0, created_at: 20, tags: [], content: '{"name":"hydrated"}',
  }, key);
  let requestedFilter;
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      requestedFilter = filter;
      send(['EVENT', subscriptionId, metadata]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);
  try {
    const result = await hydrateAccounts(
      context.memory,
      accountCollection(context.memory, [publicKey]),
      {
        relays: [relay.url],
        kinds: [0],
        timeoutMs: 2_000,
        observationLimit: 2,
        distinctEventLimit: 2,
      },
    );
    assert.deepEqual(requestedFilter, { authors: [publicKey], kinds: [0] });
    assert.deepEqual(result.acquiredEventIds, [metadata.id]);
    assert.equal(context.memory.resolveAccount(publicKey).profile.name, 'hydrated');
  } finally {
    await relay.close();
    context.close();
  }
});

test('a named public plan composes bounded acquisition, algebra, hydration, and retention', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const key = Uint8Array.from(Buffer.from('c'.repeat(64), 'hex'));
  const publicKey = getPublicKey(key);
  const note = finalizeEvent({
    kind: 1, created_at: 30, tags: [['t', 'field-recording']],
    content: 'A field recording https://media.example/birds.wav',
  }, key);
  const metadata = finalizeEvent({
    kind: 0, created_at: 31, tags: [], content: '{"name":"listener"}',
  }, key);
  const unrelated = finalizeEvent({
    kind: 1, created_at: 100, tags: [], content: 'resident but outside this acquisition',
  }, Uint8Array.from(Buffer.from('d'.repeat(64), 'hex')));
  context.memory.ingest(unrelated, {
    relay: 'wss://resident.example/',
    observedAt: '2026-07-26T10:00:00.000Z',
  });
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send, filter) => {
      for (const event of [note, metadata]) {
        if ((!filter.kinds || filter.kinds.includes(event.kind))
            && (!filter.authors || filter.authors.includes(event.pubkey))) {
          send(['EVENT', subscriptionId, event]);
        }
      }
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);
  const plan = [
    {
      id: 'orient',
      operation: 'acquire',
      parameters: {
        relays: [relay.url], filter: { kinds: [1], limit: 5 },
        timeoutMs: 2_000, observationLimit: 5, distinctEventLimit: 5,
      },
    },
    {
      id: 'notes',
      operation: 'select',
      input: 'orient',
      parameters: { kinds: [1], limit: 1 },
    },
    {
      id: 'direction',
      operation: 'filter',
      input: 'notes',
      parameters: {
        as: 'caller chose field recordings but excluded blocked.example',
        where: {
          all: [
            { field: 'event.tag', name: 't', value: 'field-recording' },
            { not: { field: 'event.linkedDomain', equals: 'blocked.example' } },
          ],
        },
        limit: 5,
      },
    },
    {
      id: 'by-author',
      operation: 'group',
      input: 'direction',
      parameters: { by: 'event.author', itemLimit: 2, limit: 5 },
    },
    {
      id: 'author-summary',
      operation: 'summarize',
      input: 'by-author',
      parameters: { aggregations: [{ name: 'count', operation: 'count' }], limit: 5 },
    },
    {
      id: 'accounts',
      operation: 'move',
      input: 'direction',
      parameters: { to: 'authors', limit: 5 },
    },
    {
      id: 'profiles',
      operation: 'hydrate',
      input: 'accounts',
      parameters: {
        relays: [relay.url], kinds: [0], timeoutMs: 2_000,
        observationLimit: 2, distinctEventLimit: 2,
      },
    },
    {
      id: 'saved',
      operation: 'retain',
      input: 'accounts',
      parameters: {
        name: 'Caller-chosen field recordists',
        options: { reason: { type: 'field-trial-choice', rationale: 'caller supplied' } },
      },
    },
  ];
  try {
    const report = await executeResearchPlan(context.memory, plan);
    assert.doesNotThrow(() => JSON.stringify(report));
    assert.deepEqual(report.plan, plan);
    assert.deepEqual(
      report.stages.map(({ id, resultKind }) => [id, resultKind]),
      [
        ['orient', 'acquisition-report'],
        ['notes', 'events'],
        ['direction', 'events'],
        ['by-author', 'groups'],
        ['author-summary', 'summaries'],
        ['accounts', 'accounts'],
        ['profiles', 'hydration-report'],
        ['saved', 'retained-selection'],
      ],
    );
    assert.equal(report.stages[0].result.budget.observationLimit, 5);
    assert.deepEqual(
      report.stages[1].result.items.map(({ subject }) => subject.id),
      [note.id],
    );
    assert.equal(report.stages[6].result.budget.distinctEventLimit, 2);
    assert.equal(context.memory.inspect({ type: 'account', id: publicKey }).resident, true);
    const retained = context.memory.getSet(report.stages[7].result.id);
    assert.equal(retained.members.length, 1);
    assert.equal(
      retained.members[0].reasons[0].retentionContext.rationale,
      'caller supplied',
    );
  } finally {
    await relay.close();
    context.close();
  }
});

test('plan preflight rejects retention of value collections before acquisition starts', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  let requestCount = 0;
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      requestCount += 1;
      const [event] = loadFixtureEvents();
      send(['EVENT', subscriptionId, event]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);

  try {
    await assert.rejects(executeResearchPlan(context.memory, [
      {
        id: 'acquired',
        operation: 'acquire',
        parameters: {
          relays: [relay.url],
          filter: { kinds: [1], limit: 1 },
          timeoutMs: 2_000,
          observationLimit: 1,
          distinctEventLimit: 1,
        },
      },
      {
        id: 'counts',
        operation: 'summarize',
        input: 'acquired',
        parameters: {
          aggregations: [{ name: 'count', operation: 'count' }],
        },
      },
      {
        id: 'invalid-retention',
        operation: 'retain',
        input: 'counts',
        parameters: { name: 'cannot retain values' },
      },
    ]), /Retention requires a subject collection; summaries collections contain no retainable subjects/);

    assert.equal(requestCount, 0);
    assert.equal(context.memory.describe().eventCount, 0);
    assert.deepEqual(context.memory.listSets(), []);
  } finally {
    await relay.close();
    context.close();
  }
});

test('global limit and cancellation are distinguishable', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const events = loadFixtureEvents();
  const limitRelay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      for (const event of events) send(['EVENT', subscriptionId, event]);
    });
  }, context.directory);

  try {
    const limited = await acquireRelayEvents(context.memory, {
      relays: [limitRelay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 1,
    });
    assert.equal(limited.completionReason, 'observation-budget');
    assert.equal(limited.counts.acceptedObservations, 1);
    const controller = new AbortController();
    const cancellationRelay = await startRelay(() => {}, context.directory);
    const pending = acquireRelayEvents(context.memory, {
      relays: [cancellationRelay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 2,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);
    const cancelled = await pending;
    assert.equal(cancelled.completionReason, 'cancelled');
    assert.equal(cancelled.relays[0].outcome, 'cancelled');
    await cancellationRelay.close();
  } finally {
    await limitRelay.close();
    context.close();
  }
});

test('distinct-event budget ignores duplicate observations while observation budget stays hard', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const [first, second, third] = loadFixtureEvents();
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      send(['EVENT', subscriptionId, first]);
      send(['EVENT', subscriptionId, first]);
      send(['EVENT', subscriptionId, second]);
      send(['EVENT', subscriptionId, third]);
    });
  }, context.directory);
  try {
    const distinctBounded = await acquireRelayEvents(context.memory, {
      relays: [relay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 10,
      distinctEventLimit: 2,
    });
    assert.equal(distinctBounded.completionReason, 'distinct-event-budget');
    assert.deepEqual(distinctBounded.counts, {
      receivedPackets: 3,
      invalid: 0,
      nonMatching: 0,
      acceptedObservations: 3,
      duplicateObservations: 1,
      newlyStoredCorpusEvents: 2,
      distinctEventsAcquired: 2,
    });

    const observationBounded = await acquireRelayEvents(context.memory, {
      relays: [relay.url],
      filter: {},
      timeoutMs: 2_000,
      observationLimit: 2,
      distinctEventLimit: 3,
    });
    assert.equal(observationBounded.completionReason, 'observation-budget');
    assert.equal(observationBounded.counts.acceptedObservations, 2);
    assert.equal(observationBounded.counts.distinctEventsAcquired, 1);
    assert.equal(observationBounded.counts.duplicateObservations, 1);

  } finally {
    await relay.close();
    context.close();
  }
});

test('canonical relay events outside the requested filter are diagnosed without ingestion', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const key = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
  const matching = finalizeEvent({
    kind: 1, created_at: 20, tags: [['t', 'research']], content: 'matching',
  }, key);
  const nonMatching = finalizeEvent({
    kind: 0, created_at: 20, tags: [['t', 'research']], content: '{}',
  }, key);
  const relay = await startRelay((connection) => {
    connection.onRequest((subscriptionId, send) => {
      send(['EVENT', subscriptionId, nonMatching]);
      send(['EVENT', subscriptionId, matching]);
      send(['EOSE', subscriptionId]);
    });
  }, context.directory);
  try {
    const result = await acquireRelayEvents(context.memory, {
      relays: [relay.url],
      filter: { kinds: [1], '#t': ['research'], since: 20, until: 20 },
      timeoutMs: 2_000,
      observationLimit: 1,
      distinctEventLimit: 1,
    });
    assert.equal(result.counts.receivedPackets, 2);
    assert.equal(result.counts.nonMatching, 1);
    assert.equal(result.relays[0].nonMatching, 1);
    assert.equal(result.counts.acceptedObservations, 1);
    assert.deepEqual(result.acquiredEventIds, [matching.id]);
    assert.equal(context.memory.getEvent(nonMatching.id), null);
    assert.deepEqual(result.coverage.observedEvents.map(({ eventId }) => eventId), [matching.id]);
  } finally {
    await relay.close();
    context.close();
  }
});

test('timeout and partial connection failure remain observable', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const context = createContext();
  const silentRelay = await startRelay(() => {}, context.directory);
  try {
    const unavailablePort = await reserveClosedPort();
    const result = await acquireRelayEvents(context.memory, {
      relays: [silentRelay.url, `wss://127.0.0.1:${unavailablePort}/`],
      filter: {},
      timeoutMs: 100,
      observationLimit: 2,
      concurrency: 2,
    });
    assert.equal(result.completionReason, 'timeout');
    assert.deepEqual(
      new Set(result.relays.map(({ outcome }) => outcome)),
      new Set(['timeout', 'connection-failure']),
    );
    const failedRelay = result.relays.find(({ outcome }) => outcome === 'connection-failure');
    assert.match(failedRelay.diagnostic, /ECONNREFUSED/);
  } finally {
    await silentRelay.close();
    context.close();
  }
});

test('acquisition rejects unusable public inputs before networking', async () => {
  const context = createContext();
  try {
    await assert.rejects(
      acquireRelayEvents(context.memory, { relays: ['ws://localhost:1'], filter: {} }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(context.memory, { relays: ['wss://localhost:1'], filter: { nope: true } }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(context.memory, {
        relays: ['wss://localhost:1'], filter: {}, eventLimit: 1,
      }),
      /Unknown acquisition options: eventLimit/,
    );
    await assert.rejects(
      acquireRelayEvents(context.memory, {
        relays: ['wss://localhost:1'], filter: {}, distinctEventLmit: 1,
      }),
      /Unknown acquisition options: distinctEventLmit/,
    );
    const account = context.memory.collection([
      { subject: subject('account', 'a'.repeat(64)), reasons: [], provenance: [] },
    ], { operation: 'account-candidates' });
    await assert.rejects(
      hydrateAccounts(context.memory, account, {
        relays: ['wss://localhost:1'], kinds: [1],
      }),
      /kinds must contain only 0 and\/or 3/,
    );
    await assert.rejects(
      hydrateAccounts(context.memory, context.memory.collection([], { operation: 'empty' }), {
        relays: ['wss://localhost:1'],
      }),
      /at least one account subject/,
    );
  } finally {
    context.close();
  }
});

function createContext() {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  const directory = mkdtempSync(join(tmpdir(), 'nostr-research-acquisition-'));
  return {
    directory,
    memory,
    close() {
      this.memory?.close();
      rmSync(this.directory, { force: true, recursive: true });
    },
  };
}

function matchesFilter(event, filter) {
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter['#e'] && !event.tags.some((tag) => (
    tag[0] === 'e' && filter['#e'].includes(tag[1])
  ))) return false;
  return true;
}

function accountCollection(memory, accounts) {
  return memory.collection(
    accounts.map((id) => ({ subject: subject('account', id) })),
    { operation: 'explicit-account-starts' },
  );
}

async function startRelay(configure, certificateDirectory) {
  const keyPath = join(certificateDirectory, 'relay-key.pem');
  const certificatePath = join(certificateDirectory, 'relay-cert.pem');
  try {
    readFileSync(keyPath);
  } catch {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=localhost', '-keyout', keyPath, '-out', certificatePath,
    ], { stdio: 'ignore' });
  }
  const sockets = new Set();
  const server = createServer({
    key: readFileSync(keyPath),
    cert: readFileSync(certificatePath),
  });
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1')
      .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    sockets.add(socket);
    const requestHandlers = [];
    let pendingClientData = Buffer.alloc(0);
    configure({
      onRequest(handler) { requestHandlers.push(handler); },
    });
    socket.on('data', (buffer) => {
      pendingClientData = Buffer.concat([pendingClientData, buffer]);
      const decoded = decodeClientFrames(pendingClientData);
      pendingClientData = pendingClientData.subarray(decoded.consumed);
      for (const frame of decoded.frames) {
        if (frame.opcode === 1 && Array.isArray(frame.message) && frame.message[0] === 'REQ') {
          for (const handler of requestHandlers) {
            handler(frame.message[1], (packet) => sendFrame(socket, packet), frame.message[2]);
          }
        } else if (frame.opcode === 8) {
          socket.write(Buffer.from([0x88, 0x00]));
          socket.end();
        }
      }
    });
    socket.on('close', () => {
      sockets.delete(socket);
    });
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `wss://127.0.0.1:${port}/`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function sendFrame(socket, value) {
  const payload = Buffer.from(JSON.stringify(value));
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function decodeClientFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 6 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    let length = buffer[offset + 1] & 0x7f;
    let header = 2;
    if (length === 126) {
      if (offset + 8 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      header = 4;
    }
    const maskStart = offset + header;
    const payloadStart = maskStart + 4;
    if (payloadStart + length > buffer.length) break;
    const mask = buffer.subarray(maskStart, payloadStart);
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + length));
    for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    let message = null;
    if (opcode === 1) try { message = JSON.parse(payload.toString()); } catch {}
    frames.push({ opcode, message });
    offset = payloadStart + length;
  }
  return { frames, consumed: offset };
}

async function reserveClosedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function supportsLoopbackListener() {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return true;
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') return false;
    throw error;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}
