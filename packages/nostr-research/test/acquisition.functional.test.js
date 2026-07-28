import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  acquireRelayEvents,
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  hydrateAccounts,
  ResearchMemoryError,
  subject,
} from '@nostr-research/memory';

const HYDRATION_KEY = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
const WARNING_KEY = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));
const WARNING_EVENTS = [
  finalizeEvent({
    kind: 1, created_at: 200, tags: [], content: 'ordinary retained event',
  }, WARNING_KEY),
  finalizeEvent({
    kind: 1, created_at: 201, tags: [['content-warning', 'sensitive']], content: 'direct warning',
  }, WARNING_KEY),
  finalizeEvent({
    kind: 1, created_at: 202,
    tags: [['L', 'content-warning'], ['l', 'graphic', 'content-warning']],
    content: 'self label warning',
  }, WARNING_KEY),
  finalizeEvent({
    kind: 1985, created_at: 203,
    tags: [['L', 'content-warning'], ['l', 'graphic', 'content-warning'], ['e', 'a'.repeat(64)]],
    content: 'third party label evidence',
  }, WARNING_KEY),
  finalizeEvent({
    kind: 1984, created_at: 204,
    tags: [['content-warning'], ['e', 'b'.repeat(64)]], content: 'third party report evidence',
  }, WARNING_KEY),
];

class RelayFixtureWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static requests = [];

  constructor(url) {
    this.url = url;
    this.readyState = RelayFixtureWebSocket.CONNECTING;
    this.listeners = new Map();
    queueMicrotask(() => {
      if (this.url.includes('pre-open')) {
        this.readyState = RelayFixtureWebSocket.CLOSED;
        this.emit('close', { code: 1006 });
        return;
      }
      this.readyState = RelayFixtureWebSocket.OPEN;
      this.emit('open', {});
    });
  }

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }

  send(serialized) {
    const packet = JSON.parse(serialized);
    if (packet[0] !== 'REQ') return;
    RelayFixtureWebSocket.requests.push(packet);
    const subscriptionId = packet[1];
    queueMicrotask(() => {
      if (this.url.includes('complete')) {
        for (let index = 0; index < 12; index += 1) {
          this.message(['NOTICE', `fixture notice ${index}`]);
        }
        this.message(['AUTH', 'neutral challenge']);
        this.message(['EOSE', 'wrong-subscription', ['more']]);
        this.message(['EOSE', subscriptionId, ['finish']]);
      } else if (this.url.includes('hydrate-multiple')) {
        this.message(['EVENT', subscriptionId, finalizeEvent({
          kind: 0, created_at: 100, tags: [], content: '{"name":"first"}',
        }, HYDRATION_KEY)]);
        this.message(['EVENT', subscriptionId, finalizeEvent({
          kind: 0, created_at: 101, tags: [], content: '{"name":"second"}',
        }, HYDRATION_KEY)]);
        this.message(['EOSE', subscriptionId]);
      } else if (this.url.includes('content-warnings')) {
        for (const event of WARNING_EVENTS) this.message(['EVENT', subscriptionId, event]);
        this.message(['EOSE', subscriptionId]);
      } else if (this.url.includes('unknown')) {
        this.message(['CLOSED', subscriptionId, 'future-prefix: visible evidence']);
      } else if (this.url.includes('refused')) {
        this.message(['CLOSED', subscriptionId, 'auth-required: fixture refusal']);
      } else if (this.url.includes('peer-close')) {
        this.readyState = RelayFixtureWebSocket.CLOSED;
        this.emit('close', { code: 1006 });
      }
    });
  }

  close() {
    this.readyState = RelayFixtureWebSocket.CLOSED;
    queueMicrotask(() => this.emit('close', { code: 1000 }));
  }

  message(packet) {
    this.emit('message', { data: JSON.stringify(packet) });
  }

  emit(name, event) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

test('relation fetch binds deduplicated values into an ordinary acquisition', async () => {
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = RelayFixtureWebSocket;
  RelayFixtureWebSocket.requests = [];
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const session = createDeclarativeResearchSession(memory);
  const firstKey = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));
  const secondKey = Uint8Array.from(Buffer.from('2'.repeat(64), 'hex'));
  const events = [
    finalizeEvent({ kind: 1, created_at: 1, tags: [], content: 'first' }, firstKey),
    finalizeEvent({ kind: 1, created_at: 2, tags: [], content: 'again' }, firstKey),
    finalizeEvent({ kind: 1, created_at: 3, tags: [], content: 'second' }, secondKey),
  ];
  try {
    for (const event of events) {
      memory.ingest(event, {
        relay: 'wss://source.example',
        observedAt: '2026-07-28T12:00:00.000Z',
      });
    }
    await session.execute({
      commandId: 'notes', command: 'select',
      parameters: { scope: 'corpus', kinds: [1], order: 'oldest', limit: 3 },
      resultId: 'notes',
    });
    await session.execute({
      commandId: 'rows', command: 'relate', input: 'notes', resultId: 'rows',
    });
    const fetched = await session.execute({
      commandId: 'fetch', command: 'fetch', input: 'rows',
      parameters: {
        relays: ['wss://complete.example'],
        filter: { kinds: [0] },
        bindings: { authors: 'event.author' },
        timeoutMs: 1000,
        observationLimit: 10,
        distinctEventLimit: 10,
        concurrency: 1,
      },
      resultId: 'profiles',
    });

    assert.equal(fetched.ok, true);
    assert.equal(fetched.result.handle.count, 0);
    assert.deepEqual(RelayFixtureWebSocket.requests.at(-1)[2], {
      kinds: [0],
      authors: [events[0].pubkey, events[2].pubkey],
    });
  } finally {
    await session.close();
    globalThis.WebSocket = originalWebSocket;
  }
});

test('acquisition rejects unusable public inputs before networking', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    await assert.rejects(
      acquireRelayEvents(memory, { relays: ['ws://localhost:1'], filter: {} }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(memory, { relays: ['wss://localhost:1'], filter: { nope: true } }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(memory, {
        relays: ['wss://localhost:1'], filter: {}, eventLimit: 1,
      }),
      /Unknown acquisition options: eventLimit/,
    );
    await assert.rejects(
      acquireRelayEvents(memory, {
        relays: ['wss://localhost:1'], filter: {}, distinctEventLmit: 1,
      }),
      /Unknown acquisition options: distinctEventLmit/,
    );
    const accounts = memory.collection([
      { subject: subject('account', 'a'.repeat(64)), reasons: [], provenance: [] },
    ], { operation: 'account-candidates' });
    await assert.rejects(
      hydrateAccounts(memory, accounts, {
        relays: ['wss://localhost:1'], kinds: [1],
      }),
      /kinds must contain only 0 and\/or 3/,
    );
    await assert.rejects(
      hydrateAccounts(memory, memory.collection([], { operation: 'empty' }), {
        relays: ['wss://localhost:1'],
      }),
      /at least one account subject/,
    );
  } finally {
    memory.close();
  }
});

test('relay acquisition excludes direct self-warnings by default with a factual override', async () => {
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = RelayFixtureWebSocket;
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  try {
    const excluded = await acquireRelayEvents(memory, {
      relays: ['wss://content-warnings.example'], filter: {},
      timeoutMs: 1000, observationLimit: 3, distinctEventLimit: 3,
    });
    assert.equal(excluded.counts.receivedPackets, 5);
    assert.equal(excluded.counts.excludedContentWarnings, 2);
    assert.equal(excluded.counts.acceptedObservations, 3);
    assert.equal(excluded.counts.distinctEventsAcquired, 3);
    assert.equal(excluded.relays[0].excludedContentWarnings, 2);
    assert.deepEqual(
      new Set(excluded.acquiredEventIds),
      new Set([WARNING_EVENTS[0].id, WARNING_EVENTS[3].id, WARNING_EVENTS[4].id]),
    );
    assert.equal(memory.describe().observationBuffer.eventCount, 3);
    assert.equal(memory.inspect(subject('event', WARNING_EVENTS[1].id)).resolved, false);
    assert.equal(memory.inspect(subject('event', WARNING_EVENTS[2].id)).resolved, false);

    const defaultSession = createDeclarativeResearchSession(memory);
    await defaultSession.execute({
      commandId: 'default-attempt', command: 'acquire',
      parameters: {
        relays: ['wss://content-warnings.example'], filter: {},
        timeoutMs: 1000, observationLimit: 3, distinctEventLimit: 3,
      },
      resultId: 'default-attempt',
    });
    const defaultCoverage = await defaultSession.execute({
      commandId: 'default-coverage', command: 'show', input: 'default-attempt',
      parameters: { mode: 'coverage', previewLimit: 10 },
    });
    assert.equal(defaultCoverage.result.counts.excludedContentWarnings, 2);
    assert.equal(defaultCoverage.result.relays[0].excludedContentWarnings, 2);
    assert.equal(defaultCoverage.result.requested.excludeContentWarnings, true);

    memory.reset();
    const session = createDeclarativeResearchSession(memory, {
      acquisition: { excludeContentWarnings: false },
    });
    const admitted = await session.execute({
      commandId: 'admit', command: 'acquire',
      parameters: {
        relays: ['wss://content-warnings.example'], filter: {},
        timeoutMs: 1000, observationLimit: 5, distinctEventLimit: 5,
      },
      resultId: 'admitted',
    });
    assert.equal(admitted.ok, true);
    assert.equal(admitted.result.external.completeness.excludedContentWarnings, 0);
    assert.equal(memory.describe().observationBuffer.eventCount, 5);

    const shown = await session.execute({
      commandId: 'shown', command: 'show', input: 'admitted',
      parameters: { mode: 'details', previewLimit: 10 },
    });
    assert.equal(shown.result.context.counts.excludedContentWarnings, 0);
    assert.equal(shown.result.context.relayDiagnostics[0].excludedContentWarnings, 0);
    assert.equal(shown.result.context.requested.excludeContentWarnings, false);

    const status = await session.execute({ commandId: 'status', command: 'status' });
    assert.equal(status.result.configuration.acquisition.excludeContentWarnings, false);
    const schema = await session.execute({
      commandId: 'schema-warning', command: 'schema', parameters: { detail: 'full' },
    });
    assert.deepEqual(
      schema.result.research.parameterContracts.acquire.excludeContentWarnings,
      {
        type: 'boolean', default: true,
        effect: 'exclude directly self-warned matching events before budgets and ingestion',
      },
    );
    assert.match(
      schema.result.research.operationFacts.acquire.resultFacts.perRelay.excludedContentWarnings,
      /excluded before budgets and ingestion/,
    );
  } finally {
    memory.close();
    globalThis.WebSocket = originalWebSocket;
  }
});

test('public acquisition and session reports preserve bounded relay messages and honest outcomes', async () => {
  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = RelayFixtureWebSocket;
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  try {
    const report = await acquireRelayEvents(memory, {
      relays: [
        'wss://complete.example',
        'wss://refused.example',
        'wss://unknown.example',
        'wss://peer-close.example',
        'wss://pre-open.example',
      ],
      filter: { kinds: [1] },
      timeoutMs: 1000,
      observationLimit: 10,
      distinctEventLimit: 10,
      concurrency: 3,
    });
    const complete = report.relays.find(({ relay }) => relay.includes('complete'));
    assert.equal(complete.outcome, 'eose');
    assert.equal(complete.notices.length, 10);
    assert.deepEqual(complete.notices[0], {
      rawValue: 'fixture notice 0', omittedCharacters: 0,
    });
    assert.equal(complete.omittedNotices, 2);
    assert.equal(complete.authChallengeObserved, true);
    assert.deepEqual(complete.authChallenge, {
      rawValue: 'neutral challenge', omittedCharacters: 0,
    });
    assert.deepEqual(complete.eoseHints, [{
      hint: 'finish', rawValue: 'finish', omittedCharacters: 0,
    }]);

    const refused = report.relays.find(({ relay }) => relay.includes('refused'));
    assert.equal(refused.outcome, 'closed');
    assert.deepEqual(refused.closedReason, {
      category: 'auth-required',
      prefix: 'auth-required',
      rawValue: 'auth-required: fixture refusal',
      omittedCharacters: 0,
    });
    assert.equal(refused.authChallengeObserved, false);
    assert.deepEqual(
      report.relays.find(({ relay }) => relay.includes('unknown')).closedReason,
      {
        category: 'unknown',
        prefix: 'future-prefix',
        rawValue: 'future-prefix: visible evidence',
        omittedCharacters: 0,
      },
    );
    assert.equal(
      report.relays.find(({ relay }) => relay.includes('peer-close')).outcome,
      'peer-closed',
    );
    assert.equal(
      report.relays.find(({ relay }) => relay.includes('pre-open')).outcome,
      'connection-failure',
    );

    const session = createDeclarativeResearchSession(memory);
    const acquired = await session.execute({
      commandId: 'acquire', command: 'acquire',
      parameters: {
        relays: ['wss://complete.example'], filter: { kinds: [1] },
        timeoutMs: 1000, observationLimit: 10, distinctEventLimit: 10,
      },
      resultId: 'attempt',
    });
    assert.equal(acquired.ok, true);
    assert.equal(acquired.result.external.status, 'complete');
    assert.equal(acquired.result.external.completeness.relays.authChallengeObserved, 1);
    assert.equal(acquired.result.external.completeness.relays.notices, 12);

    const summary = await session.execute({
      commandId: 'summary', command: 'show', input: 'attempt',
      parameters: { mode: 'summary', sizeLimit: 2000 },
    });
    assert.equal(summary.result.summary.resultKind, 'acquisition-report');
    assert.equal(summary.result.summary.countUnit, 'events');
    assert.equal(summary.result.summary.subjectCount, 0);
    assert.deepEqual(summary.result.summary.evidenceResolution, {
      buffer: 0, archive: 0, unresolved: 0,
    });
    assert.equal('eventFacts' in summary.result.summary, false);
    assert.deepEqual(summary.result.preview, []);

    const coverage = await session.execute({
      commandId: 'coverage', command: 'show', input: 'attempt',
      parameters: { mode: 'coverage', previewLimit: 10 },
    });
    assert.equal(coverage.result.relays[0].authChallengeObserved, true);
    assert.equal(coverage.result.relays[0].eoseHints[0].hint, 'finish');
    const details = await session.execute({
      commandId: 'details', command: 'show', input: 'attempt',
      parameters: { mode: 'details', previewLimit: 10 },
    });
    assert.equal(details.result.context.relayDiagnostics[0].notices[0].rawValue, 'fixture notice 0');

    const contextualSchema = await session.execute({
      commandId: 'schema', command: 'schema', input: 'attempt', parameters: {},
    });
    assert.equal(
      contextualSchema.result.structure.reportFacts.perRelay.authChallengeObserved,
      'neutral observed AUTH challenge; not a refusal',
    );
    const globalSchema = await session.execute({
      commandId: 'global-schema', command: 'schema', parameters: { detail: 'full' },
    });
    assert.equal(globalSchema.result.research.operationFacts.acquire.resultFacts.exhaustive, false);
    assert.equal(
      globalSchema.result.research.operationFacts.hydrate.resultFacts.completeness.units,
      'accounts',
    );

    const planned = await session.execute({
      commandId: 'plan', command: 'plan',
      plan: [{
        id: 'acquired', operation: 'acquire',
        parameters: {
          relays: ['wss://refused.example'], filter: { kinds: [1] },
          timeoutMs: 1000, observationLimit: 10, distinctEventLimit: 10,
        },
      }],
      outputs: { acquired: 'planned-attempt' },
    });
    assert.equal(planned.ok, true);
    const plannedCoverage = await session.execute({
      commandId: 'planned-coverage', command: 'show', input: 'planned-attempt',
      parameters: { mode: 'coverage', previewLimit: 10 },
    });
    assert.equal(plannedCoverage.result.relays[0].closedReason.category, 'auth-required');

    const seed = finalizeEvent({
      kind: 1, created_at: 99, tags: [], content: 'hydration seed',
    }, HYDRATION_KEY);
    memory.ingest(seed, {
      relay: 'wss://fixture.example',
      observedAt: '2026-07-28T10:00:00.000Z',
    });
    await session.execute({
      commandId: 'seed-account', command: 'select',
      parameters: { scope: 'corpus', ids: [seed.id] }, resultId: 'seed-note',
    });
    await session.execute({
      commandId: 'seed-author', command: 'move', input: 'seed-note',
      parameters: { to: 'authors' }, resultId: 'seed-author',
    });
    const hydrated = await session.execute({
      commandId: 'hydrate-multiple', command: 'hydrate', input: 'seed-author',
      parameters: {
        relays: ['wss://hydrate-multiple.example'],
        timeoutMs: 1000, observationLimit: 10, distinctEventLimit: 10,
      },
      resultId: 'hydrated-multiple',
    });
    assert.equal(hydrated.result.handle.count, 2);
    const hydrationCompleteness = hydrated.result.external.completeness;
    assert.equal(hydrationCompleteness.units, 'accounts');
    assert.equal(hydrationCompleteness.requested, 1);
    assert.equal(hydrationCompleteness.resolved, 1);
    assert.equal(hydrationCompleteness.acquiredMetadataEvents, 2);
    assert.equal(hydrationCompleteness.accountsWithMultipleMetadataEvents, 1);
    const hydrationSummary = await session.execute({
      commandId: 'hydrate-summary', command: 'show', input: 'hydrated-multiple',
      parameters: { mode: 'summary', sizeLimit: 2000 },
    });
    assert.equal(hydrationSummary.result.summary.resultKind, 'hydration-report');
    assert.equal(hydrationSummary.result.summary.count, 2);
    assert.equal(hydrationSummary.result.summary.countUnit, 'events');
    assert.equal(hydrationSummary.result.summary.subjectCount, 2);
    assert.deepEqual(hydrationSummary.result.summary.eventFacts, {
      resolvedEventCount: 2,
      kindHistogram: [{ kind: 0, count: 2 }],
      distinctAuthorCount: 1,
      createdAtRange: { earliest: 100, latest: 101 },
    });
  } finally {
    memory.close();
    globalThis.WebSocket = originalWebSocket;
  }
});
