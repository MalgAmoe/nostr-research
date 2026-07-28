import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireRelayEvents,
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  hydrateAccounts,
  ResearchMemoryError,
  subject,
} from '@nostr-research/memory';

class RelayFixtureWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

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
    const subscriptionId = packet[1];
    queueMicrotask(() => {
      if (this.url.includes('complete')) {
        for (let index = 0; index < 12; index += 1) {
          this.message(['NOTICE', `fixture notice ${index}`]);
        }
        this.message(['AUTH', 'neutral challenge']);
        this.message(['EOSE', 'wrong-subscription', ['more']]);
        this.message(['EOSE', subscriptionId, ['finish']]);
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
  } finally {
    memory.close();
    globalThis.WebSocket = originalWebSocket;
  }
});
