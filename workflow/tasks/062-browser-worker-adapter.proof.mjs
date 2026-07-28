// Task-level Worker lifecycle proof. The Worker-global shim is deliberately
// validation-only; the imported package subpath is the real product entry.
import { readFile } from 'node:fs/promises';

const events = JSON.parse(await readFile(
  new URL('../../packages/nostr-research/fixtures/events.json', import.meta.url),
  'utf8',
));
const listeners = new Map();
const posted = [];
const waiters = [];

globalThis.addEventListener = (type, listener) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(listener);
};
globalThis.postMessage = (value) => {
  posted.push(roundTrip(value));
  for (const resolve of waiters.splice(0)) resolve();
};

class DeterministicWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  #listeners = new Map();

  constructor(url) {
    this.url = url;
    this.readyState = DeterministicWebSocket.CONNECTING;
    queueMicrotask(() => {
      this.readyState = DeterministicWebSocket.OPEN;
      this.#emit('open', {});
    });
  }

  addEventListener(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
  }

  send(serialized) {
    const packet = JSON.parse(serialized);
    if (packet[0] !== 'REQ' || this.url.includes('pending.fixture')) return;
    const subscriptionId = packet[1];
    for (const event of events) {
      queueMicrotask(() => this.#emit('message', {
        data: JSON.stringify(['EVENT', subscriptionId, event]),
      }));
    }
    queueMicrotask(() => this.#emit('message', {
      data: JSON.stringify(['EOSE', subscriptionId]),
    }));
  }

  close() {
    if (this.readyState >= DeterministicWebSocket.CLOSING) return;
    this.readyState = DeterministicWebSocket.CLOSING;
    queueMicrotask(() => {
      this.readyState = DeterministicWebSocket.CLOSED;
      this.#emit('close', { code: 1000 });
    });
  }

  #emit(type, event) {
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

globalThis.WebSocket = DeterministicWebSocket;
await import('@nostr-research/memory/browser-worker');

function check(condition, message) {
  if (!condition) throw new Error(`Browser Worker proof failed: ${message}`);
}

function roundTrip(value) {
  return JSON.parse(JSON.stringify(value));
}

function send(message) {
  const cloned = roundTrip(message);
  for (const listener of listeners.get('message') ?? []) listener({ data: cloned });
}

async function waitForResponses(count) {
  while (posted.length < count) {
    await new Promise((resolve) => waiters.push(resolve));
  }
}

send({ commandId: 'early', command: 'status', parameters: {} });
send({
  type: 'initialize',
  commandId: 'bad-init',
  memory: { capacity: 0 },
});
send({
  type: 'initialize',
  commandId: 'start',
  memory: { capacity: 1, archiveCapacity: 1, notebookCapacity: 4 },
  configuration: {
    acquisition: {
      timeoutMs: 100,
      observationLimit: 1,
      distinctEventLimit: 2,
      concurrency: 1,
    },
    presentation: { previewLimit: 1, excerptLimit: 80, sizeLimit: 4000 },
  },
});
send({
  type: 'initialize',
  commandId: 'duplicate',
  memory: { capacity: 2 },
});
send({
  commandId: 'bounded-acquire',
  command: 'acquire',
  parameters: {
    relays: ['wss://events.fixture/'],
    filter: { kinds: [1] },
  },
  resultId: 'attempt',
});
send({ commandId: 'status', command: 'status', parameters: {} });
send({ commandId: 'malformed' });

await waitForResponses(7);

check(posted[0].commandId === 'early'
    && posted[0].error?.code === 'WORKER_NOT_INITIALIZED',
'pre-initialization command was not a correlated bounded error');
check(posted[1].commandId === 'bad-init'
    && posted[1].error?.code === 'WORKER_INITIALIZATION_FAILED',
'invalid initialization was not a correlated bounded error');
check(posted[2].ok && posted[2].result?.type === 'browser-worker-initialized',
'valid initialization did not succeed');
check(posted[3].commandId === 'duplicate'
    && posted[3].error?.code === 'WORKER_ALREADY_INITIALIZED',
'duplicate initialization was not rejected');
check(posted[4].ok && posted[4].result?.external?.completeness?.observed === 1,
'acquisition did not expose its observation bound');
check(posted[4].result.external.completeness.boundsReached.includes('observation-budget'),
'bounded acquisition did not report the reached observation limit');
check(posted[5].ok && posted[5].result?.observationBuffer?.eventCount === 1,
'sequential status did not observe the earlier acquisition');
check(posted[6].commandId === 'malformed'
    && posted[6].error?.code === 'INVALID_COMMAND',
'malformed session message did not retain the session error envelope');

send({
  commandId: 'pending-acquire',
  command: 'acquire',
  parameters: {
    relays: ['wss://pending.fixture/'],
    filter: { kinds: [1] },
    timeoutMs: 10_000,
    observationLimit: 1,
    distinctEventLimit: 1,
    concurrency: 1,
  },
  resultId: 'pending',
});
// Browser message events are separate tasks; let the session enter its public
// external-operation seam before delivering the following close event.
await Promise.resolve();
await Promise.resolve();
send({ commandId: 'close', command: 'close', parameters: {} });
send({ commandId: 'after-close', command: 'status', parameters: {} });

await waitForResponses(10);

check(posted[7].ok
    && posted[7].result?.external?.completeness?.boundsReached?.includes('cancelled'),
'close did not cancel active session acquisition');
check(posted[8].ok && posted[8].result?.type === 'close-session',
'close response did not retain the existing session shape');
check(posted[9].commandId === 'after-close'
    && posted[9].error?.code === 'SESSION_CLOSED',
'post-close command did not retain the existing session error');

for (const [index, response] of posted.entries()) {
  check(JSON.stringify(roundTrip(response)) === JSON.stringify(response),
    `response ${index} did not JSON round-trip`);
  check(!/websocket|abortsignal|runtimecapabilit/i.test(JSON.stringify(response)),
    `response ${index} leaked runtime capability state`);
}

console.log('browser Worker adapter proof passed');
