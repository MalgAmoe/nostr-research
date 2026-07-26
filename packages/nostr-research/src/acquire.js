import { isCanonicalNostrEvent, ResearchMemoryError } from './index.js';
import { connect as connectTls } from 'node:tls';
import { matchFilter } from 'nostr-tools';
import WebSocket from 'ws';

const OPTION_KEYS = new Set([
  'relays', 'filter', 'timeoutMs', 'observationLimit', 'distinctEventLimit',
  'concurrency', 'signal', 'preserve',
]);
const HYDRATION_OPTION_KEYS = new Set([
  'relays', 'kinds', 'timeoutMs', 'observationLimit', 'distinctEventLimit',
  'concurrency', 'signal', 'preserve',
]);

export const DEFAULT_ACQUISITION_TIMEOUT_MS = 10_000;
export const DEFAULT_ACQUISITION_OBSERVATION_LIMIT = 100;
export const DEFAULT_ACQUISITION_DISTINCT_EVENT_LIMIT = 100;
export const DEFAULT_RELAY_CONCURRENCY = 4;

/**
 * Acquires canonical events from explicit NIP-01 relays into an open
 * process-local research corpus. Observation and distinct-event budgets are
 * both enforced operation-wide across all relays.
 */
export async function acquireRelayEvents(memory, options, composedBudget = undefined) {
  if (!memory || typeof memory.ingest !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  const normalized = normalizeAcquisitionOptions(options);
  const corpusBefore = typeof memory.describe === 'function' ? memory.describe() : null;
  const startedAt = new Date().toISOString();
  const relayResults = normalized.relays.map((relay) => ({
    relay,
    contacted: false,
    outcome: 'pending',
    receivedPackets: 0,
    invalid: 0,
    nonMatching: 0,
    duplicateObservations: 0,
    newlyStoredCorpusEvents: 0,
    acceptedObservations: 0,
    distinctEventsAcquired: 0,
    diagnostic: null,
  }));
  const counts = {
    receivedPackets: 0,
    invalid: 0,
    nonMatching: 0,
    acceptedObservations: 0,
    duplicateObservations: 0,
    newlyStoredCorpusEvents: 0,
    distinctEventsAcquired: 0,
  };
  const acquiredEventIds = [];
  const acquiredObservations = new Map();
  const acquiredIds = new Set();
  const budgetEventIds = composedBudget?.eventIds ?? new Set();
  const composedDistinctEventLimit = composedBudget?.distinctEventLimit
    ?? normalized.distinctEventLimit;
  if (!(budgetEventIds instanceof Set)) {
    throw new ResearchMemoryError('Composed acquisition event IDs must be a Set.');
  }
  positiveInteger(composedDistinctEventLimit, 'Composed distinctEventLimit');
  const additions = { added: [], refreshed: [], evicted: [] };
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
      relayResult.contacted = true;
      const subscriptionId = `research-${crypto.randomUUID()}`;
      let socket;
      let transport;
      let settled = false;
      let finishing = false;

      const settle = () => {
        if (settled) return;
        settled = true;
        sockets.delete(socket);
        resolve();
      };

      socket = new WebSocket(relay, {
        createConnection(options) {
          transport = connectTls(options);
          transport.once('close', settle);
          return transport;
        },
      });
      sockets.add(socket);

      const finish = (outcome, diagnostic = null) => {
        if (!finishing) {
          finishing = true;
          relayResult.outcome = outcome;
          relayResult.diagnostic = diagnostic;
        }
        finishSocket(socket, subscriptionId, settle, outcome === 'cancelled', transport);
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
          relayResult.receivedPackets += 1;
          counts.receivedPackets += 1;
          const event = packet[2];
          if (!isCanonicalNostrEvent(event)) {
            relayResult.invalid += 1;
            counts.invalid += 1;
            return;
          }
          if (!matchFilter(normalized.filter, event)) {
            relayResult.nonMatching += 1;
            counts.nonMatching += 1;
            return;
          }
          // This check and ingest are synchronous, so concurrent socket
          // callbacks cannot exceed the shared operation-wide limit.
          if (counts.acceptedObservations >= normalized.observationLimit) {
            return stop('observation-budget');
          }
          const alreadyAcquired = acquiredIds.has(event.id);
          const alreadyCountedForBudget = budgetEventIds.has(event.id);
          if (!alreadyCountedForBudget
              && (budgetEventIds.size >= composedDistinctEventLimit
                || counts.distinctEventsAcquired >= normalized.distinctEventLimit)) {
            return stop('distinct-event-budget');
          }
          const ingested = memory.ingest(
            event,
            { relay, observedAt: new Date().toISOString() },
            { preserve: normalized.preserve },
          );
          (ingested.eventStored ? additions.added : additions.refreshed).push(event.id);
          additions.evicted.push(...(ingested.evicted ?? []));
          if (!acquiredObservations.has(event.id)) acquiredObservations.set(event.id, []);
          acquiredObservations.get(event.id).push(ingested.observation);
          relayResult.acceptedObservations += 1;
          counts.acceptedObservations += 1;
          if (ingested.eventStored) {
            relayResult.newlyStoredCorpusEvents += 1;
            counts.newlyStoredCorpusEvents += 1;
          }
          if (alreadyAcquired) {
            relayResult.duplicateObservations += 1;
            counts.duplicateObservations += 1;
          }
          if (!alreadyAcquired) {
            acquiredIds.add(event.id);
            budgetEventIds.add(event.id);
            acquiredEventIds.push(event.id);
            relayResult.distinctEventsAcquired += 1;
            counts.distinctEventsAcquired += 1;
          }
          if (counts.acceptedObservations >= normalized.observationLimit) {
            stop('observation-budget');
          } else if (budgetEventIds.size >= composedDistinctEventLimit
              || counts.distinctEventsAcquired >= normalized.distinctEventLimit) {
            stop('distinct-event-budget');
          }
        } else if (packet[0] === 'EOSE') {
          finish('eose');
        } else if (packet[0] === 'CLOSED') {
          finish('closed', typeof packet[2] === 'string' ? packet[2] : null);
        }
      });
      socket.addEventListener('error', (event) => {
        finish('connection-failure', describeWebSocketError(event.error));
      });
      socket.addEventListener('close', (event) => {
        if (!finishing) {
          relayResult.outcome = stopReason ?? 'connection-failure';
          relayResult.diagnostic = stopReason
            ? null
            : `Socket closed before relay completion (code ${event.code}).`;
        }
        // During a connecting-handshake cancellation, `ws` emits its close
        // event before the owned TLS transport has necessarily closed. The
        // transport listener is the shutdown boundary in that case.
        if (!transport) settle();
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
  const result = {
    requested: { filter: normalized.filter, relays: normalized.relays },
    budget: {
      timeoutMs: normalized.timeoutMs,
      observationLimit: normalized.observationLimit,
      distinctEventLimit: normalized.distinctEventLimit,
      concurrency: normalized.concurrency,
    },
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
    additions,
    corpusBefore,
    corpusAfter: typeof memory.describe === 'function' ? memory.describe() : null,
  };
  result.collection = memory.asCollection(result);
  result.coverage = {
    requested: {
      filter: result.requested.filter,
      relays: [...result.requested.relays].sort(),
    },
    budget: result.budget,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    completionReason: result.completionReason,
    exhaustive: false,
    uncertainty: 'A bounded attempt was made; relay completeness is not implied.',
    relays: [...result.relays].sort((a, b) => a.relay.localeCompare(b.relay)),
    observedEvents: result.acquiredObservations.flatMap(({ eventId, observations }) => (
      observations.map((item) => ({
        eventId, observationId: item.id, relay: item.relay, observedAt: item.observedAt,
      }))
    )).sort((a, b) => a.observationId - b.observationId),
  };
  return result;
}

/** Acquires current account metadata/contact evidence for an explicit account selection. */
export async function hydrateAccounts(memory, selection, options) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  const normalized = normalizeHydrationOptions(options);
  const authors = [...new Set(memory.asCollection(selection).items
    .filter(({ subject }) => subject.type === 'account')
    .map(({ subject }) => subject.id))];
  if (authors.length === 0) {
    throw new ResearchMemoryError('Account hydration requires at least one account subject.');
  }
  const {
    relays, kinds, timeoutMs, observationLimit, distinctEventLimit,
    concurrency, signal, preserve,
  } = normalized;
  return acquireRelayEvents(memory, {
    relays,
    filter: { authors, kinds: [...new Set(kinds)] },
    timeoutMs,
    observationLimit,
    distinctEventLimit,
    concurrency,
    signal,
    preserve,
  });
}

function describeWebSocketError(error) {
  if (!(error instanceof Error)) return 'WebSocket connection or protocol error.';
  const code = typeof error.code === 'string' ? `${error.code}: ` : '';
  return `${code}${error.message}`;
}

function finishSocket(socket, subscriptionId, onClosed, force = false, transport = undefined) {
  if (force && socket.readyState !== WebSocket.CLOSED) {
    // Cancellation is an ownership boundary, not a normal relay completion.
    // During a TLS/WebSocket handshake `ws.terminate()` can run before `ws`
    // has attached the transport as its active socket. Destroy the transport
    // we created as well, so awaiting acquisition cancellation also awaits the
    // actual owned TCP/TLS connection closing.
    transport?.destroy();
    socket.terminate();
    return;
  }
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

export function normalizeAcquisitionOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ResearchMemoryError('Acquisition options are required.');
  }
  const unknown = Object.keys(options).filter((key) => !OPTION_KEYS.has(key));
  if (unknown.length) {
    throw new ResearchMemoryError(`Unknown acquisition options: ${unknown.join(', ')}.`);
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
  const observationLimit = positiveInteger(
    options.observationLimit ?? DEFAULT_ACQUISITION_OBSERVATION_LIMIT,
    'observationLimit',
  );
  const distinctEventLimit = positiveInteger(
    options.distinctEventLimit ?? DEFAULT_ACQUISITION_DISTINCT_EVENT_LIMIT,
    'distinctEventLimit',
  );
  const concurrency = positiveInteger(options.concurrency ?? DEFAULT_RELAY_CONCURRENCY, 'concurrency');
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ResearchMemoryError('signal must be an AbortSignal.');
  }
  if (options.preserve !== undefined && !Array.isArray(options.preserve)) {
    throw new ResearchMemoryError('preserve must be an array of event subjects.');
  }
  return {
    relays, filter, timeoutMs, observationLimit, distinctEventLimit,
    concurrency, signal: options.signal,
    preserve: structuredClone(options.preserve ?? []),
  };
}

export function normalizeHydrationOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ResearchMemoryError('Account hydration options are required.');
  }
  const unknown = Object.keys(options).filter((key) => !HYDRATION_OPTION_KEYS.has(key));
  if (unknown.length) {
    throw new ResearchMemoryError(`Unknown account hydration options: ${unknown.join(', ')}.`);
  }
  const kinds = options.kinds ?? [0];
  if (!Array.isArray(kinds) || kinds.length === 0
      || kinds.some((kind) => ![0, 3].includes(kind))) {
    throw new ResearchMemoryError('Account hydration kinds must contain only 0 and/or 3.');
  }
  const { kinds: ignoredKinds, ...acquisition } = options;
  const normalized = normalizeAcquisitionOptions({ ...acquisition, filter: { kinds: [0] } });
  return { ...normalized, kinds: [...new Set(kinds)] };
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
