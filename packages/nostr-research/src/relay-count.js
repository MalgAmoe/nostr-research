import {
  boundedRelayText,
  describeWebSocketError,
  normalizeFilter,
  parseClosedReason,
} from './acquire.js';
import { RESEARCH_CONSTRAINTS } from './configuration.js';
import { ResearchMemoryError } from './protocol.js';
import { normalizeRelayUrl } from './relay-url.js';

const CONSTRAINTS = RESEARCH_CONSTRAINTS.relayCount;
const CONNECTING = 0;
const OPEN = 1;

export function normalizeRelayCountOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new ResearchMemoryError('Relay count parameters must be an object.');
  }
  const allowed = new Set(['filter', 'relays', 'timeoutMs', 'concurrency', 'signal']);
  const unknown = Object.keys(options).find((key) => !allowed.has(key));
  if (unknown) throw new ResearchMemoryError(`Unknown relay count parameter: ${unknown}.`);
  if (!Array.isArray(options.relays) || options.relays.length === 0
      || options.relays.some((relay) => typeof relay !== 'string')) {
    throw new ResearchMemoryError('Relay count requires a non-empty relay URL array.');
  }
  if (options.relays.length > CONSTRAINTS.relayLimit.maximum) {
    throw new ResearchMemoryError(
      `Relay count accepts at most ${CONSTRAINTS.relayLimit.maximum} relays.`,
    );
  }
  const relays = options.relays.map((relay) => normalizeRelayUrl(relay, 'Relay URL'));
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Relay count relay URLs must not be repeated.');
  }
  const filter = normalizeFilter(options.filter);
  const timeoutMs = boundedInteger(options.timeoutMs ?? CONSTRAINTS.timeoutMs.default,
    CONSTRAINTS.timeoutMs, 'timeoutMs');
  const concurrency = boundedInteger(options.concurrency ?? CONSTRAINTS.concurrency.default,
    CONSTRAINTS.concurrency, 'concurrency');
  if (options.signal !== undefined && !isAbortSignal(options.signal)) {
    throw new ResearchMemoryError('signal must be an AbortSignal.');
  }
  return { filter, relays, timeoutMs, concurrency, signal: options.signal };
}

export async function countRelayEvents(options = {}) {
  const normalized = normalizeRelayCountOptions(options);
  const WebSocketConstructor = globalThis.WebSocket;
  if (typeof WebSocketConstructor !== 'function') {
    throw new ResearchMemoryError(
      'Relay count requires the standard WebSocket interface in this runtime.',
    );
  }
  const startedAt = new Date().toISOString();
  const outcomes = new Array(normalized.relays.length);
  const activeFinishes = new Set();
  let cursor = 0;
  let stopReason = normalized.signal?.aborted ? 'cancelled' : null;
  const stop = (reason) => {
    if (stopReason) return;
    stopReason = reason;
    for (const finish of [...activeFinishes]) finish(reason);
  };
  const timer = setTimeout(() => stop('timeout'), normalized.timeoutMs);
  const abort = () => stop('cancelled');
  normalized.signal?.addEventListener('abort', abort, { once: true });

  const worker = async () => {
    while (!stopReason && cursor < normalized.relays.length) {
      const index = cursor;
      cursor += 1;
      outcomes[index] = await countAtRelay(
        normalized.relays[index], normalized.filter, WebSocketConstructor, activeFinishes,
      );
    }
  };
  try {
    await Promise.all(Array.from(
      { length: Math.min(normalized.concurrency, normalized.relays.length) }, worker,
    ));
  } finally {
    clearTimeout(timer);
    normalized.signal?.removeEventListener('abort', abort);
    for (const finish of [...activeFinishes]) finish(stopReason ?? 'cancelled');
  }
  for (let index = 0; index < normalized.relays.length; index += 1) {
    if (!outcomes[index]) {
      outcomes[index] = baseOutcome(normalized.relays[index], stopReason ?? 'cancelled', {
        contacted: false,
        diagnostic: `Relay attempt did not start before operation ${stopReason ?? 'cancellation'}.`,
      });
    }
  }
  return {
    type: 'relay-count-report',
    requested: { filter: structuredClone(normalized.filter), relays: [...normalized.relays] },
    startedAt,
    finishedAt: new Date().toISOString(),
    bounds: {
      timeoutMs: normalized.timeoutMs,
      concurrency: normalized.concurrency,
      relayLimit: CONSTRAINTS.relayLimit.maximum,
      textLengthLimit: 512,
      hllLength: 512,
    },
    outcomes,
    omissions: {
      unstartedRelays: outcomes.filter(({ contacted }) => !contacted).length,
    },
  };
}

function countAtRelay(relay, filter, WebSocketConstructor, activeFinishes) {
  return new Promise((resolve) => {
    const result = baseOutcome(relay, 'pending', { contacted: true });
    const requestId = `count-${crypto.randomUUID()}`;
    let socket;
    try {
      socket = new WebSocketConstructor(relay);
    } catch (error) {
      resolve(baseOutcome(relay, 'connection-failure', {
        contacted: true, diagnostic: describeWebSocketError(error),
      }));
      return;
    }
    let opened = false;
    let settled = false;
    const finish = (outcome, details = {}) => {
      if (settled) return;
      settled = true;
      activeFinishes.delete(finish);
      closeSocket(socket);
      resolve({ ...result, outcome, ...withBoundedDiagnostic(details) });
    };
    activeFinishes.add(finish);
    socket.addEventListener('open', () => {
      if (settled) return;
      opened = true;
      try {
        socket.send(JSON.stringify(['COUNT', requestId, filter]));
      } catch (error) {
        finish('peer-error', { diagnostic: describeWebSocketError(error) });
      }
    });
    socket.addEventListener('message', (message) => {
      if (settled) return;
      let packet;
      try {
        packet = JSON.parse(typeof message.data === 'string' ? message.data : String(message.data));
      } catch {
        return;
      }
      if (!Array.isArray(packet)) return;
      if (packet[0] === 'AUTH' && typeof packet[1] === 'string') {
        result.authChallengeObserved = true;
        result.authChallenge = boundedRelayText(packet[1]);
        return;
      }
      if (packet[0] === 'NOTICE' && typeof packet[1] === 'string') {
        finish('notice', { notice: boundedRelayText(packet[1]) });
        return;
      }
      if (packet[1] !== requestId) return;
      if (packet[0] === 'CLOSED') {
        const closedReason = parseClosedReason(packet[2]);
        finish('closed', {
          closedReason,
          diagnostic: closedReason?.rawValue ?? null,
          diagnosticOmittedCharacters: closedReason?.omittedCharacters ?? 0,
        });
        return;
      }
      if (packet[0] !== 'COUNT') return;
      const response = validatePayload(packet[2]);
      if (!response) {
        finish('malformed-response', {
          diagnostic: 'Matching COUNT response payload was malformed.',
          response: retainMalformedPayload(packet[2]),
        });
        return;
      }
      finish('success', { response });
    });
    socket.addEventListener('error', (event) => {
      finish(opened ? 'peer-error' : 'connection-failure', {
        diagnostic: describeWebSocketError(event.error),
      });
    });
    socket.addEventListener('close', (event) => {
      if (!settled) {
        finish(opened ? 'peer-closed' : 'connection-failure', {
          diagnostic: opened
            ? `Opened peer closed before count response (code ${event.code}).`
            : `Socket closed before opening (code ${event.code}).`,
        });
      }
    });
  });
}

function validatePayload(payload) {
  if (!isPlainObject(payload)
      || !Number.isSafeInteger(payload.count) || payload.count < 0
      || (payload.approximate !== undefined && typeof payload.approximate !== 'boolean')
      || (payload.hll !== undefined
        && (typeof payload.hll !== 'string' || !/^[0-9a-fA-F]{512}$/.test(payload.hll)))) {
    return null;
  }
  return {
    count: payload.count,
    approximate: payload.approximate === true,
    ...(payload.hll === undefined ? {} : { hll: payload.hll }),
  };
}

function retainMalformedPayload(payload) {
  if (!isPlainObject(payload)) {
    const retained = retainMalformedValue(payload);
    return {
      ...retained,
      omissions: {
        unrecognizedFields: 0,
        omittedStructuredValues: retained.valueOmitted ? 1 : 0,
        omittedCharacters: retained.omittedCharacters ?? 0,
      },
    };
  }
  const knownFields = ['count', 'approximate', 'hll'];
  const retained = Object.fromEntries(knownFields
    .filter((field) => Object.hasOwn(payload, field))
    .map((field) => [field, retainMalformedValue(payload[field])]));
  const values = Object.values(retained);
  return {
    type: 'object',
    ...retained,
    omissions: {
      unrecognizedFields: Object.keys(payload)
        .filter((field) => !knownFields.includes(field)).length,
      omittedStructuredValues: values.filter(({ valueOmitted }) => valueOmitted).length,
      omittedCharacters: values.reduce(
        (sum, value) => sum + (value.omittedCharacters ?? 0), 0,
      ),
    },
  };
}

function retainMalformedValue(value) {
  if (typeof value === 'string') return { type: 'string', ...boundedRelayText(value) };
  if (value === null) return { type: 'null', value: null };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { type: typeof value, value };
  }
  return {
    type: Array.isArray(value) ? 'array' : typeof value,
    valueOmitted: true,
  };
}

function baseOutcome(relay, outcome, details = {}) {
  return {
    relay,
    contacted: false,
    outcome,
    authChallengeObserved: false,
    authChallenge: null,
    ...withBoundedDiagnostic(details),
  };
}

function withBoundedDiagnostic(details) {
  if (typeof details.diagnostic !== 'string') return details;
  const bounded = boundedRelayText(details.diagnostic);
  return {
    ...details,
    diagnostic: bounded.rawValue,
    diagnosticOmittedCharacters:
      details.diagnosticOmittedCharacters ?? bounded.omittedCharacters,
  };
}

function closeSocket(socket) {
  if (socket.readyState === OPEN || socket.readyState === CONNECTING) {
    try {
      socket.close(1000, 'count complete');
    } catch {
      // Logical completion does not depend on transport teardown.
    }
  }
}

function boundedInteger(value, bounds, name) {
  if (!Number.isSafeInteger(value) || value < bounds.minimum || value > bounds.maximum) {
    throw new ResearchMemoryError(
      `${name} must be an integer from ${bounds.minimum} to ${bounds.maximum}.`,
    );
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isAbortSignal(value) {
  return typeof AbortSignal === 'function' && value instanceof AbortSignal;
}
