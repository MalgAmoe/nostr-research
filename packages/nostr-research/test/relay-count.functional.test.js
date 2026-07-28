import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  executeResearchOperation,
  executeResearchPlan,
} from '@nostr-research/memory';

class CountWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    queueMicrotask(() => {
      if (url.includes('pre-open-error')) {
        this.emit('error', { error: new Error('x'.repeat(2048)) });
      } else if (url.includes('pre-open')) {
        this.readyState = 3;
        this.emit('close', { code: 1006 });
      } else {
        this.readyState = 1;
        this.emit('open', {});
      }
    });
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  send(serialized) {
    const [type, id] = JSON.parse(serialized);
    if (type !== 'COUNT') return;
    queueMicrotask(() => {
      if (this.url.includes('exact')) this.message(['COUNT', id, { count: 12 }]);
      else if (this.url.includes('approximate')) {
        this.message(['AUTH', 'neutral challenge']);
        this.message(['COUNT', id, { count: 34, approximate: true, hll: 'ab'.repeat(256) }]);
      } else if (this.url.includes('notice')) this.message(['NOTICE', 'unknown command']);
      else if (this.url.includes('closed')) {
        this.message(['CLOSED', id, 'auth-required: fixture refusal']);
      } else if (this.url.includes('malformed')) {
        this.message(['COUNT', id, {
          count: { nested: { unrestricted: 'x'.repeat(2048) } },
          approximate: 'y'.repeat(2048),
          hll: 'z'.repeat(2048),
          ignored: 'not retained',
        }]);
      } else if (this.url.includes('peer-close')) {
        this.readyState = 3;
        this.emit('close', { code: 1006 });
      }
    });
  }
  close() {
    this.readyState = 3;
    queueMicrotask(() => this.emit('close', { code: 1000 }));
  }
  message(packet) { this.emit('message', { data: JSON.stringify(packet) }); }
  emit(name, event) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

test('relay count remains attributed and never creates a global total', async () => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = CountWebSocket;
  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const relays = [
    'wss://exact.example/', 'wss://approximate.example/', 'wss://notice.example/',
    'wss://closed.example/', 'wss://malformed.example/', 'wss://peer-close.example/',
    'wss://pre-open.example/', 'wss://pre-open-error.example/',
  ];
  try {
    const before = memory.describe();
    const direct = await executeResearchOperation(memory, {
      operation: 'relay-count',
      parameters: { filter: { kinds: [1] }, relays, timeoutMs: 1000, concurrency: 3 },
    });
    assert.deepEqual(direct.outcomes.map(({ outcome }) => outcome), [
      'success', 'success', 'notice', 'closed', 'malformed-response',
      'peer-closed', 'connection-failure', 'connection-failure',
    ]);
    assert.deepEqual(direct.outcomes[0].response, { count: 12, approximate: false });
    assert.equal(direct.outcomes[1].response.hll.length, 512);
    assert.equal(direct.outcomes[1].authChallengeObserved, true);
    assert.equal(direct.outcomes[2].notice.rawValue, 'unknown command');
    assert.equal(direct.outcomes[3].closedReason.category, 'auth-required');
    assert.deepEqual(direct.outcomes[4].response.count, {
      type: 'object',
      valueOmitted: true,
    });
    assert.equal(direct.outcomes[4].response.approximate.rawValue.length, 512);
    assert.equal(direct.outcomes[4].response.approximate.omittedCharacters, 1536);
    assert.equal(direct.outcomes[4].response.hll.rawValue.length, 512);
    assert.equal(direct.outcomes[4].response.hll.omittedCharacters, 1536);
    assert.deepEqual(direct.outcomes[4].response.omissions, {
      unrecognizedFields: 1,
      omittedStructuredValues: 1,
      omittedCharacters: 3072,
    });
    assert.equal(JSON.stringify(direct.outcomes[4]).includes('unrestricted'), false);
    assert.equal(direct.outcomes[7].diagnostic.length, 512);
    assert.equal(direct.outcomes[7].diagnosticOmittedCharacters, 1536);
    assert.deepEqual(memory.describe(), before);

    const plan = await executeResearchPlan(memory, [{
      id: 'count', operation: 'relay-count',
      parameters: {
        filter: {}, relays: ['wss://exact.example/'], timeoutMs: 1000, concurrency: 1,
      },
    }]);
    assert.equal(plan.stages[0].result.outcomes[0].response.count, 12);

    const session = createDeclarativeResearchSession(memory, {
      relays: ['wss://exact.example/', 'wss://approximate.example/'],
      acquisition: { timeoutMs: 1000, concurrency: 1 },
    });
    const counted = await session.execute({
      commandId: 'count', command: 'relay-count',
      parameters: { filter: { kinds: [1] }, concurrency: 2 }, resultId: 'counts',
    });
    assert.equal(counted.ok, true, JSON.stringify(counted));
    assert.deepEqual(counted.result.handle, {
      id: 'counts', kind: 'relay-count', count: 2, revision: 1, scope: 'external-report',
    });
    const shown = {};
    for (const mode of ['summary', 'preview', 'coverage', 'details']) {
      shown[mode] = (await session.execute({
        commandId: mode, command: 'show', input: 'counts',
        parameters: { mode, previewLimit: 10 },
      })).result;
    }
    assert.deepEqual({
      outcomes: shown.summary.summary.outcomes,
      exactResponses: shown.summary.summary.exactResponses,
      approximateResponses: shown.summary.summary.approximateResponses,
    }, {
      outcomes: [{ outcome: 'success', count: 2 }],
      exactResponses: 1,
      approximateResponses: 1,
    });
    assert.equal(JSON.stringify(shown.summary).includes('"count":46'), false);
    assert.deepEqual(shown.preview.preview.map(({ count }) => count), [12, 34]);
    const schema = await session.execute({
      commandId: 'schema', command: 'schema', input: 'counts', parameters: {},
    });
    assert.equal(schema.result.structure.kind, 'relay-count');
    assert.deepEqual(schema.result.compatibleOperations, []);
    assert.deepEqual(schema.result.structure.observationModes,
      ['summary', 'preview', 'coverage', 'details']);
    assert.equal((await session.execute({
      commandId: 'bad', command: 'show', input: 'counts', parameters: { mode: 'explain' },
    })).ok, false);
    assert.equal((await session.execute({
      commandId: 'release', command: 'release', input: 'counts', parameters: {},
    })).result.released, true);
  } finally {
    memory.close();
    if (original === undefined) delete globalThis.WebSocket;
    else globalThis.WebSocket = original;
  }
});

test('relay count cancellation distinguishes started and unstarted attempts', async () => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = CountWebSocket;
  const memory = createInMemoryResearchMemory({ capacity: 1 });
  try {
    const controller = new AbortController();
    queueMicrotask(() => controller.abort());
    const result = await executeResearchOperation(memory, {
      operation: 'relay-count',
      parameters: {
        filter: {}, relays: ['wss://hanging.example/', 'wss://exact.example/'],
        timeoutMs: 1000, concurrency: 1, signal: controller.signal,
      },
    });
    assert.deepEqual(result.outcomes.map(({ outcome }) => outcome), ['cancelled', 'cancelled']);
    assert.equal(result.omissions.unstartedRelays, 1);
  } finally {
    memory.close();
    if (original === undefined) delete globalThis.WebSocket;
    else globalThis.WebSocket = original;
  }
});
