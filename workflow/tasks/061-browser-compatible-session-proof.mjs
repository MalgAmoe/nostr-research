// Task-level portability proof. This is deliberately not part of the package's
// permanent test suite and imports only the public package entry.

const originalBuffer = globalThis.Buffer;
const originalWebSocket = globalThis.WebSocket;
globalThis.Buffer = undefined;

const events = [
  {
    kind: 1,
    created_at: 1700000000,
    tags: [
      ['t', 'nostr'],
      ['p', 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'],
    ],
    content: 'Fixture event one.',
    pubkey: '84bf7562262bbd6940085748f3be6afa52ae317155181ece31b66351ccffa4b0',
    id: '78c49d12afd45ddadb9b547051c344352060a9aa9a1665de8fd8695b4aa8d30c',
    sig: 'f5324cbaa1d4fb0b73663dbf7c5e3e2d2f0b11b8856d601a0e9780bbf7b504a99870a380b227fbc94827e8c21c99da206e94029faa2fe7ab7184a1c0f5b6836b',
  },
  {
    kind: 1,
    created_at: 1700000060,
    tags: [
      ['e', '0000000000000000000000000000000000000000000000000000000000000000',
        'wss://fixture.example'],
    ],
    content: 'Fixture event two.',
    pubkey: '84bf7562262bbd6940085748f3be6afa52ae317155181ece31b66351ccffa4b0',
    id: '551a93b4a7328b57fcb3e9f65cb63571c553673ef77a01603a6811d61ec5d1d0',
    sig: '961fd8420b5beb412adb69a9d3cd20228c178ed814fa85df00eff63ad1875b69723fe450a033786f8a2e1f61e99073f77aa275331344cfd266393dc60eb3f1b3',
  },
];

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
    if (packet[0] !== 'REQ') return;
    const subscriptionId = packet[1];
    if (this.url.includes('pending.fixture')) return;
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

function check(condition, message) {
  if (!condition) throw new Error(`Browser-like proof failed: ${message}`);
}

function plainData(value, label) {
  check(structuredClone(value) !== value, `${label} is not structured-cloneable data`);
  check(JSON.parse(JSON.stringify(value)) !== undefined, `${label} is not JSON data`);
}

function excludesRuntimeCapabilities(value, label) {
  const serialized = JSON.stringify(value);
  check(!serialized.includes('"signal"'), `${label} serializes an AbortSignal seam`);
  check(!/websocket/i.test(serialized), `${label} serializes a WebSocket seam`);
  check(!serialized.includes('"Buffer"'), `${label} serializes a Node Buffer seam`);
}

try {
  globalThis.WebSocket = DeterministicWebSocket;
  const {
    createDeclarativeResearchSession,
    createInMemoryResearchMemory,
    normalizeResearchOperation,
    operationSchema,
  } = await import('@nostr-research/memory');

  check(globalThis.Buffer === undefined, 'Buffer was available while loading the public entry');

  const schema = operationSchema();
  const normalized = normalizeResearchOperation({
    operation: 'acquire',
    parameters: {
      relays: ['wss://events.fixture/'],
      filter: { kinds: [1] },
      timeoutMs: 100,
      observationLimit: 4,
      distinctEventLimit: 4,
      concurrency: 1,
    },
  });
  plainData(schema, 'operation schema');
  plainData(normalized, 'normalized operation');
  excludesRuntimeCapabilities(schema, 'operation schema');
  excludesRuntimeCapabilities(normalized, 'normalized operation');

  const memory = createInMemoryResearchMemory({ capacity: 8 });
  const session = createDeclarativeResearchSession(memory);
  const commands = [
    {
      commandId: 'configure',
      command: 'configure',
      parameters: {
        relays: ['wss://events.fixture/'],
        acquisition: {
          timeoutMs: 100,
          observationLimit: 4,
          distinctEventLimit: 4,
          concurrency: 1,
        },
        presentation: { previewLimit: 2, excerptLimit: 80, sizeLimit: 12000 },
      },
    },
    {
      commandId: 'acquire',
      command: 'acquire',
      parameters: { filter: { kinds: [1] } },
      resultId: 'attempt',
    },
    {
      commandId: 'select',
      command: 'select',
      input: 'attempt',
      parameters: { limit: 2 },
      resultId: 'events',
    },
    {
      commandId: 'navigate',
      command: 'move',
      input: 'events',
      parameters: { to: 'authors', limit: 2 },
      resultId: 'authors',
    },
    {
      commandId: 'show',
      command: 'show',
      input: 'authors',
      parameters: { mode: 'details', previewLimit: 1, sizeLimit: 4000 },
    },
    {
      commandId: 'inspect',
      command: 'inspect',
      parameters: {
        subject: { type: 'event', id: events[0].id },
        includeEvidence: true,
        previewLimit: 2,
      },
    },
    { commandId: 'status', command: 'status', parameters: {} },
  ];

  for (const command of commands) plainData(command, `${command.command} command`);
  const responses = [];
  for (const command of commands) responses.push(await session.execute(command));
  for (const response of responses) {
    plainData(response, `${response.commandId} response`);
    excludesRuntimeCapabilities(response, `${response.commandId} response`);
    check(response.ok, `${response.commandId} returned ${response.error?.message}`);
  }

  const acquisition = responses[1].result;
  check(acquisition.external?.status === 'complete', 'acquisition was not complete');
  check(acquisition.external?.completeness?.distinctEvents === 2,
    'two canonical events were not acquired');
  check(acquisition.external?.completeness?.relays?.outcomes?.[0]?.outcome === 'eose',
    'relay completion was not visible');
  check(responses[2].result.handle.count === 2,
    'the bounded acquisition result was not selected');
  check(responses[3].result.handle.count === 1,
    'author navigation did not use the acquired events');
  check(responses[4].result.count === 1, 'bounded show did not expose the author');
  check(responses[5].result.resolved === true, 'subject inspection did not resolve evidence');
  check(responses[5].result.provenance?.observations === 1
      && responses[5].result.provenance?.relays?.[0] === 'wss://events.fixture/',
    'inspection omitted relay provenance');
  check(responses[6].result.observationBuffer.eventCount === 2, 'status omitted memory state');
  check(responses[6].result.handleCount === 3, 'status omitted session handles');

  const pendingMemory = createInMemoryResearchMemory({ capacity: 2 });
  const pendingSession = createDeclarativeResearchSession(pendingMemory, {
    relays: ['wss://pending.fixture/'],
    acquisition: {
      timeoutMs: 10000,
      observationLimit: 2,
      distinctEventLimit: 2,
      concurrency: 1,
    },
  });
  const pending = pendingSession.execute({
    commandId: 'pending-acquire',
    command: 'acquire',
    parameters: { filter: { kinds: [1] } },
    resultId: 'pending',
  });
  // Let dispatch enter the public external-operation seam before close asks
  // the session to abort it; this is microtask ordering, not a timing claim.
  await Promise.resolve();
  await Promise.resolve();
  const closing = pendingSession.execute({
    commandId: 'close-pending',
    command: 'close',
    parameters: {},
  });
  const cancelled = await pending;
  const closedPending = await closing;
  check(cancelled.ok, 'cancelled acquisition did not return its bounded report');
  check(cancelled.result.external?.completeness?.boundsReached?.includes('cancelled'),
    'session close did not cancel through the public acquisition seam');
  check(cancelled.result.external?.status === 'partial',
    'cancelled acquisition did not expose partial completeness');
  check(closedPending.ok && closedPending.result.type === 'close-session',
    'the cancellation session did not close');
  excludesRuntimeCapabilities(cancelled, 'cancelled acquisition response');

  const closed = await session.execute({
    commandId: 'close',
    command: 'close',
    parameters: {},
  });
  check(closed.ok && closed.result.type === 'close-session', 'main session did not close');
  plainData(closed, 'close response');
  excludesRuntimeCapabilities(closed, 'close response');
  const closedError = await session.execute({
    commandId: 'after-close',
    command: 'status',
    parameters: {},
  });
  check(!closedError.ok && closedError.error?.code === 'SESSION_CLOSED',
    'session errors were not visible as structured envelopes');
  plainData(closedError, 'error response');
  excludesRuntimeCapabilities(closedError, 'error response');

  console.log('browser-like declarative session proof passed');
} finally {
  globalThis.Buffer = originalBuffer;
  globalThis.WebSocket = originalWebSocket;
}
