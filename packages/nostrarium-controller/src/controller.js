const encoder = new TextEncoder();

export function createNavigatorController({
  request,
  closeTransport,
  transcript: transcriptLimits,
} = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('request must be a function.');
  }
  if (closeTransport !== undefined && typeof closeTransport !== 'function') {
    throw new TypeError('closeTransport must be a function when provided.');
  }
  const limits = validateTranscriptLimits(transcriptLimits);
  const instanceId = randomId();
  let nextCommand = 0;
  let nextSequence = 0;
  let lifecycle = 'open';
  let observedRevision = null;
  let tail = Promise.resolve();
  let closing;
  let catalog = null;
  let catalogRevision = null;
  let latestTransportFailure = null;
  const pending = new Set();
  const entries = [];
  let retainedBytes = 0;
  let omittedEntries = 0;
  let omittedBytes = 0;

  function execute(commandDraft) {
    if (lifecycle !== 'open') {
      return Promise.reject(lifecycleError(lifecycle));
    }
    return enqueue(commandDraft);
  }

  function enqueue(commandDraft) {
    if (!isPlainObject(commandDraft)) {
      return Promise.reject(new TypeError('commandDraft must be a plain object.'));
    }
    if (Object.hasOwn(commandDraft, 'commandId')) {
      return Promise.reject(new TypeError('commandDraft must not contain commandId.'));
    }

    const commandId = `${instanceId}-${++nextCommand}`;
    let command;
    try {
      command = structuredClone({ ...commandDraft, commandId });
    } catch (error) {
      return Promise.reject(error);
    }
    pending.add(commandId);
    const outcome = tail.then(() => dispatch(command));
    tail = outcome.catch(() => {});
    return outcome.finally(() => pending.delete(commandId));
  }

  async function dispatch(command) {
    const revisionBefore = observedRevision;
    const sequence = ++nextSequence;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    let responseSnapshot;
    try {
      const response = await request(structuredClone(command));
      responseSnapshot = snapshotResponse(response);
      if (responseSnapshot.commandId !== command.commandId) {
        throw correlationError(command.commandId, responseSnapshot.commandId);
      }
      if (Number.isSafeInteger(responseSnapshot.sessionRevision)
          && responseSnapshot.sessionRevision >= 0) {
        observedRevision = responseSnapshot.sessionRevision;
      }
      const entry = finishEntry({
        sequence, command, response: responseSnapshot, startedAt, startedMs,
      });
      retain(entry);
      return {
        response,
        receipt: createReceipt(responseSnapshot, revisionBefore),
      };
    } catch (error) {
      const failure = failureSnapshot(error);
      latestTransportFailure = structuredClone(failure);
      const entry = finishEntry({
        sequence,
        command,
        ...(responseSnapshot === undefined ? {} : { response: responseSnapshot }),
        transportFailure: failure,
        startedAt,
        startedMs,
      });
      retain(entry);
      throw error;
    }
  }

  function retain(entry) {
    const bytes = serializedBytes(entry);
    if (bytes > limits.maxBytes || limits.maxEntries === 0) {
      omittedEntries += 1;
      omittedBytes += bytes;
      return;
    }
    entries.push({ entry, bytes });
    retainedBytes += bytes;
    while (entries.length > limits.maxEntries || retainedBytes > limits.maxBytes) {
      const omitted = entries.shift();
      retainedBytes -= omitted.bytes;
      omittedEntries += 1;
      omittedBytes += omitted.bytes;
    }
  }

  function state() {
    return structuredClone({
      lifecycle,
      observedRevision,
      pendingCommandIds: [...pending],
      transcript: transcriptAccounting(),
      latestTransportFailure,
      handleCatalog: catalog,
      catalogRevision,
      catalogStale: catalog === null
        || lifecycle !== 'open'
        || catalogRevision !== observedRevision,
    });
  }

  function getTranscript(options = {}) {
    if (!isPlainObject(options)) {
      throw new TypeError('transcript options must be a plain object.');
    }
    const allowed = new Set(['afterSequence', 'limit']);
    for (const key of Object.keys(options)) {
      if (!allowed.has(key)) throw new TypeError(`Unsupported transcript option: ${key}.`);
    }
    const afterSequence = options.afterSequence ?? 0;
    const limit = options.limit ?? limits.maxEntries;
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
      throw new TypeError('afterSequence must be a non-negative integer.');
    }
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new TypeError('limit must be a non-negative integer.');
    }
    return structuredClone({
      entries: entries
        .filter(({ entry }) => entry.sequence > afterSequence)
        .slice(0, limit)
        .map(({ entry }) => entry),
      ...transcriptAccounting(),
    });
  }

  async function synchronize() {
    if (lifecycle !== 'open') throw lifecycleError(lifecycle);
    const list = await execute({ command: 'list', parameters: {} });
    if (list.response.ok === true) {
      catalog = structuredClone(list.response.result);
      catalogRevision = Number.isSafeInteger(list.response.sessionRevision)
        ? list.response.sessionRevision : observedRevision;
    }
    const status = await execute({ command: 'status', parameters: {} });
    return { list, status };
  }

  function close() {
    if (closing) return closing;
    if (lifecycle === 'closed') return Promise.resolve();
    lifecycle = 'closing';
    closing = (async () => {
      let outcome;
      let commandFailure;
      try {
        outcome = await enqueue({ command: 'close', parameters: {} });
      } catch (error) {
        commandFailure = error;
      }
      let closerFailure;
      try {
        await closeTransport?.();
      } catch (error) {
        closerFailure = error;
      } finally {
        lifecycle = 'closed';
      }
      if (commandFailure) throw commandFailure;
      if (closerFailure) throw closerFailure;
      return outcome;
    })();
    return closing;
  }

  function transcriptAccounting() {
    return {
      retainedEntries: entries.length,
      retainedBytes,
      omittedEntries,
      omittedBytes,
      maxEntries: limits.maxEntries,
      maxBytes: limits.maxBytes,
    };
  }

  return Object.freeze({
    execute,
    state,
    transcript: getTranscript,
    synchronize,
    close,
  });
}

function createReceipt(response, revisionBefore) {
  const receipt = {
    commandId: response.commandId,
    ok: response.ok,
  };
  if (revisionBefore !== null) receipt.revisionBefore = revisionBefore;
  if (Number.isSafeInteger(response.sessionRevision)) {
    receipt.revisionAfter = response.sessionRevision;
    if (revisionBefore !== null) {
      receipt.revisionChanged = revisionBefore !== response.sessionRevision;
    }
  }
  const handle = response.result?.handle;
  if (isPlainObject(handle)) {
    receipt.handle = pickPresent(handle, ['id', 'kind', 'count', 'scope']);
  }
  const external = response.result?.external;
  if (isPlainObject(external)) {
    const mechanical = pickPresent(external, ['status']);
    const boundsReached = external.boundsReached ?? external.completeness?.boundsReached;
    if (boundsReached !== undefined) mechanical.boundsReached = structuredClone(boundsReached);
    if (Object.keys(mechanical).length) receipt.external = mechanical;
  }
  if (Array.isArray(response.warnings)) {
    receipt.warningCount = response.warnings.length;
    receipt.warnings = structuredClone(response.warnings);
  }
  if (isPlainObject(response.error)) {
    receipt.error = pickPresent(response.error, ['code', 'message']);
  }
  return receipt;
}

function snapshotResponse(response) {
  if (!isPlainObject(response)) {
    throw new TypeError('Transport response must be a plain structured object.');
  }
  let snapshot;
  try {
    snapshot = structuredClone(response);
  } catch {
    throw new TypeError('Transport response must be structured-cloneable.');
  }
  if (typeof snapshot.commandId !== 'string') {
    throw new TypeError('Transport response must carry a string commandId.');
  }
  return snapshot;
}

function finishEntry(fields) {
  const endedMs = Date.now();
  const { startedMs, ...entry } = fields;
  return structuredClone({
    ...entry,
    endedAt: new Date(endedMs).toISOString(),
    durationMs: Math.max(0, endedMs - startedMs),
  });
}

function failureSnapshot(error) {
  return {
    name: typeof error?.name === 'string' ? error.name : 'Error',
    message: typeof error?.message === 'string' ? error.message : String(error),
  };
}

function correlationError(expected, received) {
  const error = new Error(
    `Response commandId ${JSON.stringify(received)} does not match ${JSON.stringify(expected)}.`,
  );
  error.name = 'NavigatorControllerCorrelationError';
  return error;
}

function lifecycleError(lifecycle) {
  const error = new Error(`Navigator controller is ${lifecycle}.`);
  error.name = 'NavigatorControllerLifecycleError';
  return error;
}

function validateTranscriptLimits(value) {
  if (!isPlainObject(value)) {
    throw new TypeError('transcript with maxEntries and maxBytes is required.');
  }
  for (const key of Object.keys(value)) {
    if (!['maxEntries', 'maxBytes'].includes(key)) {
      throw new TypeError(`Unsupported transcript configuration: ${key}.`);
    }
  }
  if (!Number.isSafeInteger(value.maxEntries) || value.maxEntries < 0) {
    throw new TypeError('transcript.maxEntries must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(value.maxBytes) || value.maxBytes < 0) {
    throw new TypeError('transcript.maxBytes must be a non-negative integer.');
  }
  return { maxEntries: value.maxEntries, maxBytes: value.maxBytes };
}

function randomId() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `navigator-${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function serializedBytes(value) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

function pickPresent(source, keys) {
  return Object.fromEntries(keys
    .filter((key) => Object.hasOwn(source, key))
    .map((key) => [key, structuredClone(source[key])]));
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
