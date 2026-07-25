import { isCanonicalNostrEvent, ResearchMemoryError } from './index.js';
import WebSocket from 'ws';

export const DEFAULT_ACQUISITION_TIMEOUT_MS = 10_000;
export const DEFAULT_ACQUISITION_EVENT_LIMIT = 100;
export const DEFAULT_RELAY_CONCURRENCY = 4;

/**
 * Acquires canonical events from explicit NIP-01 relays into an open
 * ResearchMemory. `eventLimit` bounds accepted valid EVENT messages globally.
 */
export async function acquireRelayEvents(memory, options) {
  if (!memory || typeof memory.ingest !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  const normalized = normalizeOptions(options);
  const startedAt = new Date().toISOString();
  const relayResults = normalized.relays.map((relay) => ({
    relay,
    outcome: 'pending',
    received: 0,
    invalid: 0,
    duplicate: 0,
    newlyStored: 0,
    observations: 0,
    diagnostic: null,
  }));
  const counts = { received: 0, invalid: 0, duplicate: 0, newlyStored: 0, observations: 0 };
  const acquiredEventIds = [];
  const acquiredObservations = new Map();
  const acquiredIds = new Set();
  const sockets = new Set();
  let stopReason = null;
  let nextRelay = 0;

  const stop = (reason) => {
    if (stopReason) return;
    stopReason = reason;
    for (const socket of sockets) socket.__researchFinish(reason);
  };

  const timeout = setTimeout(() => stop('timeout'), normalized.timeoutMs);
  const abort = () => stop('cancelled');
  normalized.signal?.addEventListener('abort', abort, { once: true });
  if (normalized.signal?.aborted) stop('cancelled');

  async function worker() {
    while (!stopReason) {
      const index = nextRelay;
      nextRelay += 1;
      if (index >= normalized.relays.length) return;
      await acquireFromRelay(normalized.relays[index], relayResults[index]);
    }
  }

  async function acquireFromRelay(relay, relayResult) {
    await new Promise((resolve) => {
      const subscriptionId = `research-${crypto.randomUUID()}`;
      const socket = new WebSocket(relay);
      sockets.add(socket);
      let settled = false;
      let finishing = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        sockets.delete(socket);
        resolve();
      };

      const finish = (outcome, diagnostic = null) => {
        if (!finishing) {
          finishing = true;
          relayResult.outcome = outcome;
          relayResult.diagnostic = diagnostic;
        }
        finishSocket(socket, subscriptionId, settle);
      };
      socket.__researchFinish = finish;

      socket.addEventListener('open', () => {
        if (finishing || stopReason) return finish(stopReason ?? relayResult.outcome);
        socket.send(JSON.stringify(['REQ', subscriptionId, normalized.filter]));
      });
      socket.addEventListener('message', (message) => {
        if (settled || stopReason) return;
        let packet;
        try {
          packet = JSON.parse(typeof message.data === 'string' ? message.data : String(message.data));
        } catch {
          return;
        }
        if (!Array.isArray(packet) || packet[1] !== subscriptionId) return;

        if (packet[0] === 'EVENT') {
          relayResult.received += 1;
          counts.received += 1;
          const event = packet[2];
          if (!isCanonicalNostrEvent(event)) {
            relayResult.invalid += 1;
            counts.invalid += 1;
            return;
          }
          // This check and ingest are synchronous, so concurrent socket
          // callbacks cannot exceed the shared operation-wide limit.
          if (counts.observations >= normalized.eventLimit) return stop('limit');
          const ingested = memory.ingest(event, { relay, observedAt: new Date().toISOString() });
          if (!acquiredObservations.has(event.id)) acquiredObservations.set(event.id, []);
          acquiredObservations.get(event.id).push(ingested.observation);
          relayResult.observations += 1;
          counts.observations += 1;
          if (ingested.eventStored) {
            relayResult.newlyStored += 1;
            counts.newlyStored += 1;
          } else {
            relayResult.duplicate += 1;
            counts.duplicate += 1;
          }
          if (!acquiredIds.has(event.id)) {
            acquiredIds.add(event.id);
            acquiredEventIds.push(event.id);
          }
          if (counts.observations >= normalized.eventLimit) stop('limit');
        } else if (packet[0] === 'EOSE') {
          finish('eose');
        } else if (packet[0] === 'CLOSED') {
          finish('closed', typeof packet[2] === 'string' ? packet[2] : null);
        }
      });
      socket.addEventListener('error', () => {
        finish('connection-failure', 'WebSocket connection or protocol error.');
      });
      socket.addEventListener('close', (event) => {
        if (!finishing) {
          relayResult.outcome = stopReason ?? 'connection-failure';
          relayResult.diagnostic = stopReason
            ? null
            : `Socket closed before relay completion (code ${event.code}).`;
        }
        settle();
      });
    });
  }

  try {
    await Promise.all(
      Array.from(
        { length: Math.min(normalized.concurrency, normalized.relays.length) },
        () => worker(),
      ),
    );
  } finally {
    clearTimeout(timeout);
    normalized.signal?.removeEventListener('abort', abort);
    for (const socket of sockets) socket.__researchFinish(stopReason ?? 'completed');
  }

  const completionReason = stopReason ?? 'completed';
  for (const relayResult of relayResults) {
    if (relayResult.outcome === 'pending') relayResult.outcome = completionReason;
  }
  return {
    requested: { filter: normalized.filter, relays: normalized.relays },
    startedAt,
    finishedAt: new Date().toISOString(),
    completionReason,
    acquiredEventIds,
    acquiredObservations: acquiredEventIds.map((eventId) => ({
      eventId,
      observations: acquiredObservations.get(eventId) ?? [],
    })),
    relays: relayResults,
    counts,
  };
}

function finishSocket(socket, subscriptionId, onClosed) {
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(['CLOSE', subscriptionId]));
    } catch {
      // Socket teardown still proceeds.
    }
    try {
      socket.close(1000, 'acquisition complete');
    } catch {
      // A concurrent peer close can race teardown.
    }
    // A peer is allowed to ignore the closing handshake. Do not let it extend
    // the caller's timeout or cancellation indefinitely.
    const forceClose = setTimeout(() => socket.terminate(), 50);
    forceClose.unref();
    socket.addEventListener('close', () => clearTimeout(forceClose), { once: true });
  } else if (
    socket.readyState === WebSocket.CONNECTING
    || socket.readyState === WebSocket.CLOSING
  ) {
    // `close()` cannot abort a CONNECTING socket and a CLOSING peer may never
    // answer. ws exposes the transport-level termination needed to guarantee
    // that this operation releases sockets it owns.
    socket.terminate();
  } else if (socket.readyState === WebSocket.CLOSED) {
    onClosed();
  }
}

function normalizeOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ResearchMemoryError('Acquisition options are required.');
  }
  if (!Array.isArray(options.relays) || options.relays.length === 0) {
    throw new ResearchMemoryError('At least one explicit wss:// relay is required.');
  }
  const relays = options.relays.map(normalizeRelay);
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Relay URLs must not be repeated.');
  }
  const filter = normalizeFilter(options.filter);
  const timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_ACQUISITION_TIMEOUT_MS, 'timeoutMs');
  const eventLimit = positiveInteger(options.eventLimit ?? DEFAULT_ACQUISITION_EVENT_LIMIT, 'eventLimit');
  const concurrency = positiveInteger(options.concurrency ?? DEFAULT_RELAY_CONCURRENCY, 'concurrency');
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ResearchMemoryError('signal must be an AbortSignal.');
  }
  return { relays, filter, timeoutMs, eventLimit, concurrency, signal: options.signal };
}

function normalizeRelay(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ResearchMemoryError(`Invalid relay URL: ${value}`);
  }
  if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
    throw new ResearchMemoryError(`Relay URL must be an explicit wss:// URL: ${value}`);
  }
  return url.href;
}

function normalizeFilter(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new ResearchMemoryError('A Nostr filter JSON object is required.');
  }
  const copy = structuredClone(filter);
  for (const [key, value] of Object.entries(copy)) {
    if (['ids', 'authors'].includes(key)) {
      if (!isStringArray(value)) throw new ResearchMemoryError(`Filter ${key} must be an array of strings.`);
    } else if (key === 'kinds') {
      if (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item) || item < 0)) {
        throw new ResearchMemoryError('Filter kinds must be an array of non-negative integers.');
      }
    } else if (['since', 'until', 'limit'].includes(key)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new ResearchMemoryError(`Filter ${key} must be a non-negative integer.`);
      }
    } else if (key.startsWith('#')) {
      if (key.length !== 2 || !isStringArray(value)) {
        throw new ResearchMemoryError(`Filter ${key} must be a single-letter tag with an array of strings.`);
      }
    } else {
      throw new ResearchMemoryError(`Unsupported Nostr filter field: ${key}`);
    }
  }
  return copy;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ResearchMemoryError(`${name} must be a positive integer.`);
  }
  return value;
}
