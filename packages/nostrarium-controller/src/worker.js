const INITIALIZE_COMMAND_ID = 'nostrarium-worker-initialize';

export async function createBrowserWorkerTransport(options = {}) {
  const configuration = validateOptions(options);
  const { worker } = configuration;
  let lifecycle = 'initializing';
  let pending = null;
  let closePromise = null;
  let latestFailure = null;

  worker.addEventListener('message', consumeMessage);
  worker.addEventListener('messageerror', () => {
    fail('MESSAGE_ERROR', 'The browser Worker returned an unreadable message.');
  });
  worker.addEventListener('error', () => {
    fail('WORKER_ERROR', 'The browser Worker reported an execution error.');
  });

  const initialized = await exchange({
    type: 'initialize',
    commandId: INITIALIZE_COMMAND_ID,
    memory: configuration.memory,
    ...(configuration.configuration === undefined
      ? {} : { configuration: configuration.configuration }),
  }, true);
  if (!initialized.ok) {
    lifecycle = 'failed';
    worker.terminate();
    throw transportError(
      'WORKER_INITIALIZATION_FAILED',
      initialized.error?.message ?? 'The browser Worker rejected initialization.',
    );
  }
  lifecycle = 'open';

  function request(command) {
    if (!isPlainObject(command) || typeof command.commandId !== 'string') {
      return Promise.reject(new TypeError(
        'command must be a plain object with a string commandId.',
      ));
    }
    if (lifecycle !== 'open') {
      return Promise.reject(transportError(
        'TRANSPORT_NOT_OPEN',
        `The browser Worker transport is ${lifecycle}.`,
      ));
    }
    return exchange(command, false);
  }

  function exchange(command, initializing) {
    if (pending) {
      return Promise.reject(transportError(
        'REQUEST_IN_FLIGHT',
        'The browser Worker transport already has a request in flight.',
      ));
    }
    let cloned;
    try {
      cloned = structuredClone(command);
    } catch (error) {
      return Promise.reject(new TypeError(
        `command must be structured-cloneable: ${error.message}`,
      ));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        fail(
          'RESPONSE_TIMEOUT',
          `No Worker response arrived within ${configuration.responseTimeoutMs}ms.`,
        );
      }, configuration.responseTimeoutMs);
      pending = {
        commandId: command.commandId,
        resolve,
        reject,
        timer,
        initializing,
      };
      try {
        worker.postMessage(cloned);
      } catch (error) {
        fail('POST_MESSAGE_FAILED', `Could not send a command to the Worker: ${error.message}`);
      }
    });
  }

  function consumeMessage(event) {
    const response = event.data;
    if (!isPlainObject(response) || typeof response.commandId !== 'string') {
      fail('MALFORMED_RESPONSE', 'The browser Worker response has no string commandId.');
      return;
    }
    if (!pending) {
      fail('UNEXPECTED_RESPONSE', 'The browser Worker responded without a pending request.');
      return;
    }
    if (response.commandId !== pending.commandId) {
      fail(
        'MISMATCHED_COMMAND_ID',
        `Worker response commandId ${JSON.stringify(response.commandId)} does not match `
          + `${JSON.stringify(pending.commandId)}.`,
      );
      return;
    }
    const settled = pending;
    pending = null;
    clearTimeout(settled.timer);
    settled.resolve(structuredClone(response));
  }

  function fail(code, message) {
    if (lifecycle === 'closed' || lifecycle === 'failed') return;
    lifecycle = 'failed';
    const error = transportError(code, message);
    latestFailure = error.details;
    if (pending) {
      const settled = pending;
      pending = null;
      clearTimeout(settled.timer);
      settled.reject(error);
    }
    worker.terminate();
  }

  function transportError(code, message) {
    const error = new Error(message);
    error.name = 'BrowserWorkerTransportError';
    error.code = code;
    error.details = status();
    return error;
  }

  function status() {
    return {
      lifecycle,
      pendingCommandId: pending?.commandId ?? null,
      latestFailure: latestFailure === null ? null : structuredClone(latestFailure),
    };
  }

  function close() {
    if (closePromise) return closePromise;
    closePromise = Promise.resolve().then(() => {
      if (lifecycle !== 'failed') lifecycle = 'closed';
      if (pending) {
        const settled = pending;
        pending = null;
        clearTimeout(settled.timer);
        settled.reject(transportError(
          'TRANSPORT_CLOSED',
          'The browser Worker transport closed with a request in flight.',
        ));
      }
      worker.terminate();
    });
    return closePromise;
  }

  return Object.freeze({ request, status, close });
}

function validateOptions(options) {
  if (!isPlainObject(options)) throw new TypeError('options must be a plain object.');
  const allowed = new Set(['worker', 'memory', 'configuration', 'responseTimeoutMs']);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new TypeError(`Unsupported Worker transport option: ${key}.`);
  }
  if (!isWorkerLike(options.worker)) throw new TypeError('worker must be a Worker-like object.');
  if (!isPlainObject(options.memory)) throw new TypeError('memory must be a plain object.');
  if (options.configuration !== undefined && !isPlainObject(options.configuration)) {
    throw new TypeError('configuration must be a plain object.');
  }
  if (!Number.isSafeInteger(options.responseTimeoutMs) || options.responseTimeoutMs <= 0) {
    throw new TypeError('responseTimeoutMs must be a positive integer.');
  }
  return { ...options };
}

function isWorkerLike(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.addEventListener === 'function'
    && typeof value.postMessage === 'function'
    && typeof value.terminate === 'function';
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
