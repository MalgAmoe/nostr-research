import { RESEARCH_CONSTRAINTS } from './configuration.js';
import { ResearchMemoryError } from './protocol.js';
import { normalizeRelayUrl } from './relay-url.js';

const CONSTRAINTS = RESEARCH_CONSTRAINTS.relayInformation;
const KNOWN_STRING_FIELDS = new Set([
  'name', 'description', 'pubkey', 'contact', 'software', 'version',
]);

export function normalizeRelayInformationOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new ResearchMemoryError('Relay information parameters must be an object.');
  }
  const allowed = new Set(['relays', 'timeoutMs', 'concurrency', 'signal']);
  const unknown = Object.keys(options).find((key) => !allowed.has(key));
  if (unknown) throw new ResearchMemoryError(`Unknown relay information parameter: ${unknown}.`);
  if (!Array.isArray(options.relays) || options.relays.length === 0
      || options.relays.some((relay) => typeof relay !== 'string')) {
    throw new ResearchMemoryError('Relay information requires a non-empty relay URL array.');
  }
  if (options.relays.length > CONSTRAINTS.relayLimit.maximum) {
    throw new ResearchMemoryError(
      `Relay information accepts at most ${CONSTRAINTS.relayLimit.maximum} relays.`,
    );
  }
  const relays = options.relays.map((relay) => normalizeRelayUrl(relay, 'Relay URL'));
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Relay information relay URLs must not be repeated.');
  }
  const timeoutMs = boundedInteger(
    options.timeoutMs ?? CONSTRAINTS.timeoutMs.default, CONSTRAINTS.timeoutMs, 'timeoutMs',
  );
  const concurrency = boundedInteger(
    options.concurrency ?? CONSTRAINTS.concurrency.default,
    CONSTRAINTS.concurrency,
    'concurrency',
  );
  if (options.signal !== undefined && !isAbortSignal(options.signal)) {
    throw new ResearchMemoryError('signal must be an AbortSignal.');
  }
  return { relays, timeoutMs, concurrency, signal: options.signal };
}

export async function inspectRelayInformation(options = {}) {
  const normalized = normalizeRelayInformationOptions(options);
  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, normalized.timeoutMs);
  const abort = () => controller.abort();
  normalized.signal?.addEventListener('abort', abort, { once: true });
  const outcomes = new Array(normalized.relays.length);
  let cursor = 0;
  const worker = async () => {
    while (!controller.signal.aborted && cursor < normalized.relays.length) {
      const index = cursor;
      cursor += 1;
      outcomes[index] = await retrieveRelayInformation(
        normalized.relays[index], controller.signal, () => timedOut,
      );
    }
  };
  try {
    await Promise.all(Array.from(
      { length: Math.min(normalized.concurrency, normalized.relays.length) },
      worker,
    ));
  } finally {
    clearTimeout(timeout);
    normalized.signal?.removeEventListener('abort', abort);
  }
  const cancelledOutcome = timedOut ? 'timeout' : 'connection-failure';
  for (let index = 0; index < normalized.relays.length; index += 1) {
    if (!outcomes[index]) {
      outcomes[index] = baseOutcome(normalized.relays[index], cancelledOutcome, {
        diagnostic: timedOut
          ? 'The operation duration bound was reached before retrieval completed.'
          : 'The operation was cancelled before retrieval completed.',
      });
    }
  }
  return {
    type: 'relay-information-report',
    requested: { relays: [...normalized.relays] },
    startedAt,
    finishedAt: new Date().toISOString(),
    bounds: {
      timeoutMs: normalized.timeoutMs,
      concurrency: normalized.concurrency,
      responseByteLimit: CONSTRAINTS.responseByteLimit.maximum,
      stringLengthLimit: CONSTRAINTS.stringLength.maximum,
      arrayLengthLimit: CONSTRAINTS.arrayLength.maximum,
      fieldLimit: CONSTRAINTS.fieldLimit.maximum,
      nestingLimit: CONSTRAINTS.nestingLimit.maximum,
    },
    outcomes,
    omissions: {
      unstartedRelays: outcomes.filter(({ diagnostic }) => (
        diagnostic?.includes('before retrieval completed')
      )).length,
    },
  };
}

async function retrieveRelayInformation(relay, signal, timedOut) {
  const endpoint = relay.replace(/^wss:/, 'https:');
  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: 'application/nostr+json' },
      signal,
    });
  } catch (error) {
    return baseOutcome(relay, signal.aborted && timedOut() ? 'timeout' : 'connection-failure', {
      endpoint,
      diagnostic: boundedDiagnostic(error),
    });
  }
  const status = Number.isSafeInteger(response.status) ? response.status : null;
  const contentType = boundedString(response.headers?.get?.('content-type') ?? '', 256).value;
  const http = { status, contentType: contentType || null };
  if (!response.ok) {
    await response.body?.cancel?.().catch(() => {});
    return baseOutcome(relay, 'http-error', { endpoint, http });
  }
  if (!compatibleContentType(contentType)) {
    await response.body?.cancel?.().catch(() => {});
    return baseOutcome(relay, 'incompatible-content', {
      endpoint, http, diagnostic: 'Response Content-Type is not Nostr or JSON media.',
    });
  }
  let bytes;
  try {
    bytes = await boundedResponseBytes(response, CONSTRAINTS.responseByteLimit.maximum);
  } catch (error) {
    const outcome = error?.code === 'RESPONSE_TOO_LARGE' ? 'oversized-response'
      : signal.aborted && timedOut() ? 'timeout' : 'connection-failure';
    return baseOutcome(relay, outcome, {
      endpoint, http, diagnostic: boundedDiagnostic(error),
    });
  }
  let document;
  try {
    document = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    return baseOutcome(relay, 'invalid-json', {
      endpoint, http, responseBytes: bytes.byteLength, diagnostic: boundedDiagnostic(error),
    });
  }
  if (!isPlainObject(document)) {
    return baseOutcome(relay, 'malformed-known-fields', {
      endpoint,
      http,
      responseBytes: bytes.byteLength,
      diagnostic: 'The advertised document must be a JSON object.',
    });
  }
  const malformedFields = malformedKnownFields(document);
  const retained = retainDocument(document);
  if (malformedFields.length) {
    return baseOutcome(relay, 'malformed-known-fields', {
      endpoint,
      http,
      responseBytes: bytes.byteLength,
      document: retained.value,
      omissions: retained.omissions,
      malformedFields,
      diagnostic: `Malformed known fields: ${malformedFields.join(', ')}.`,
    });
  }
  const supportedNips = document.supported_nips === undefined
    ? undefined : [...new Set(document.supported_nips)].sort((left, right) => left - right);
  const limitations = isPlainObject(document.limitation)
    ? retainDocument(document.limitation).value : undefined;
  return baseOutcome(relay, 'success', {
    endpoint,
    http,
    responseBytes: bytes.byteLength,
    document: retained.value,
    omissions: retained.omissions,
    advertised: {
      ...(supportedNips === undefined ? {} : { supportedNips }),
      ...(limitations === undefined ? {} : { limitations }),
      ...(typeof document.limitation?.auth_required === 'boolean'
        ? { advertisedAuthRequired: document.limitation.auth_required } : {}),
    },
  });
}

async function boundedResponseBytes(response, limit) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw tooLarge();
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw tooLarge();
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function malformedKnownFields(document) {
  const malformed = [];
  for (const name of KNOWN_STRING_FIELDS) {
    if (document[name] !== undefined && typeof document[name] !== 'string') malformed.push(name);
  }
  if (document.supported_nips !== undefined && (
    !Array.isArray(document.supported_nips)
    || document.supported_nips.some((item) => !Number.isSafeInteger(item) || item < 0)
  )) malformed.push('supported_nips');
  if (document.limitation !== undefined && !isPlainObject(document.limitation)) {
    malformed.push('limitation');
  } else if (document.limitation?.auth_required !== undefined
      && typeof document.limitation.auth_required !== 'boolean') {
    malformed.push('limitation.auth_required');
  }
  return malformed;
}

function retainDocument(value, depth = 0, omissions = {
  stringsTruncated: 0, arrayItems: 0, fields: 0, nestedValues: 0,
}) {
  if (typeof value === 'string') {
    const retained = boundedString(value, CONSTRAINTS.stringLength.maximum);
    if (retained.omitted) omissions.stringsTruncated += 1;
    return { value: retained.value, omissions };
  }
  if (Array.isArray(value)) {
    const kept = value.slice(0, CONSTRAINTS.arrayLength.maximum);
    omissions.arrayItems += value.length - kept.length;
    return {
      value: kept.map((item) => retainDocument(item, depth + 1, omissions).value),
      omissions,
    };
  }
  if (isPlainObject(value)) {
    if (depth >= CONSTRAINTS.nestingLimit.maximum) {
      omissions.nestedValues += 1;
      return { value: null, omissions };
    }
    const entries = Object.entries(value);
    const kept = entries.slice(0, CONSTRAINTS.fieldLimit.maximum);
    omissions.fields += entries.length - kept.length;
    return {
      value: Object.fromEntries(kept.map(([key, item]) => [
        boundedString(key, CONSTRAINTS.stringLength.maximum).value,
        retainDocument(item, depth + 1, omissions).value,
      ])),
      omissions,
    };
  }
  return { value, omissions };
}

function baseOutcome(relay, outcome, details = {}) {
  return { relay, outcome, ...details };
}

function compatibleContentType(value) {
  const media = value.split(';', 1)[0].trim().toLowerCase();
  return media === 'application/nostr+json' || media === 'application/json'
    || media.endsWith('+json');
}

function boundedDiagnostic(error) {
  return boundedString(
    typeof error?.message === 'string' ? error.message : String(error),
    280,
  ).value;
}

function boundedString(value, limit) {
  return value.length <= limit
    ? { value, omitted: 0 }
    : { value: value.slice(0, limit), omitted: value.length - limit };
}

function tooLarge() {
  const error = new Error('Response exceeded the retained response byte bound.');
  error.code = 'RESPONSE_TOO_LARGE';
  return error;
}

function boundedInteger(value, constraint, name) {
  if (!Number.isSafeInteger(value) || value < constraint.minimum || value > constraint.maximum) {
    throw new ResearchMemoryError(
      `${name} must be an integer from ${constraint.minimum} to ${constraint.maximum}.`,
    );
  }
  return value;
}

function isAbortSignal(value) {
  return value && typeof value.aborted === 'boolean'
    && typeof value.addEventListener === 'function';
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
