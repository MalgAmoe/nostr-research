import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from './index.js';

let session;
let responseTail = Promise.resolve();

globalThis.addEventListener('message', (event) => {
  let response;
  try {
    response = handleMessage(event.data);
  } catch {
    response = failure(
      commandIdFrom(event.data),
      session?.revision ?? 0,
      'WORKER_MESSAGE_FAILED',
      'The Worker could not process the message.',
    );
  }
  const boundedResponse = Promise.resolve(response).catch(() => failure(
    commandIdFrom(event.data),
    session?.revision ?? 0,
    'WORKER_MESSAGE_FAILED',
    'The Worker could not process the message.',
  ));
  responseTail = responseTail
    .then(() => boundedResponse)
    .then((value) => globalThis.postMessage(value))
    .catch(() => {});
});

function handleMessage(message) {
  if (isPlainObject(message) && message.type === 'initialize') {
    return initialize(message);
  }

  if (!session) {
    return failure(
      commandIdFrom(message),
      0,
      'WORKER_NOT_INITIALIZED',
      'Initialize the browser Worker before sending session commands.',
    );
  }

  return session.execute(message);
}

function initialize(message) {
  const commandId = commandIdFrom(message);
  if (session) {
    return failure(
      commandId,
      session.revision,
      'WORKER_ALREADY_INITIALIZED',
      'The browser Worker already owns a research session.',
    );
  }

  try {
    validateInitialization(message);
    const memory = createInMemoryResearchMemory(message.memory);
    session = createDeclarativeResearchSession(memory, message.configuration ?? {});
    return {
      ok: true,
      commandId: message.commandId,
      sessionRevision: session.revision,
      result: { type: 'browser-worker-initialized' },
      warnings: [],
    };
  } catch {
    return failure(
      commandId,
      0,
      'WORKER_INITIALIZATION_FAILED',
      'The browser Worker initialization message was rejected.',
    );
  }
}

function validateInitialization(message) {
  if (!isPlainObject(message)) throw new TypeError('Invalid initialization message.');
  const allowed = new Set(['type', 'commandId', 'memory', 'configuration']);
  if (Object.keys(message).some((key) => !allowed.has(key))) {
    throw new TypeError('Unknown initialization field.');
  }
  if (typeof message.commandId !== 'string' || message.commandId.trim().length === 0) {
    throw new TypeError('Invalid initialization commandId.');
  }
  if (!isPlainObject(message.memory)) throw new TypeError('Invalid memory configuration.');
  if (message.configuration !== undefined && !isPlainObject(message.configuration)) {
    throw new TypeError('Invalid session configuration.');
  }
}

function commandIdFrom(message) {
  return isPlainObject(message) && typeof message.commandId === 'string'
    ? message.commandId
    : null;
}

function failure(commandId, sessionRevision, code, message) {
  return {
    ok: false,
    commandId,
    sessionRevision,
    error: { code, message, details: {} },
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
