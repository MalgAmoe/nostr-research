import { acquireRelayEvents } from './acquire.js';
import { ResearchMemoryError } from './index.js';

const RELATIONSHIP_TYPES = new Set([
  'author', 'reply-root', 'reply-parent', 'mentioned-event', 'quoted-event',
  'mentioned-account', 'follow', 'topic', 'other-tag',
]);
const OPTION_KEYS = new Set([
  'relays', 'relationshipTypes', 'direction', 'depth', 'limit',
  'authoredLimit', 'timeoutMs', 'observationLimit', 'distinctEventLimit',
  'concurrency', 'signal',
]);

/**
 * Expands an explicit selection through bounded local traversal and targeted
 * relay acquisition. It changes the active corpus, but never a session selection.
 */
export async function expandResearch(memory, selection, options) {
  const normalized = normalizeExpansionOptions(memory, selection, options);
  const startedAt = Date.now();
  const corpusBefore = memory.describe();
  const starting = memory.asCollection(selection);
  const startingSubjects = starting.items.map(({ subject }) => structuredClone(subject));
  const protectedEvents = startingSubjects.filter(({ type }) => type === 'event');
  if (protectedEvents.length > corpusBefore.capacity) {
    throw new ResearchMemoryError(
      'Expansion corpus capacity must accommodate all explicit event starts.',
    );
  }

  const requestedFilters = new Set();
  const requestedEventIds = new Set();
  const requestedAccounts = new Set();
  const requestedInboundIds = new Set();
  const requestedAuthoredAccounts = new Set();
  const requests = [];
  const totals = {
    receivedPackets: 0, invalid: 0, acceptedObservations: 0,
    duplicateObservations: 0, newlyStoredCorpusEvents: 0,
    distinctEventsAcquired: 0,
  };
  const operationEventIds = new Set();
  let completionReason = 'completed';
  let unresolvedBefore = null;
  const traversalOptions = {
    relationshipTypes: normalized.relationshipTypes,
    direction: normalized.direction,
    depth: normalized.depth,
    limit: normalized.limit,
  };
  const traverse = () => memory.traverse(starting, traversalOptions);

  const acquireFilter = async (makeFilter, request = {}) => {
    const remainingObservations = normalized.observationLimit - totals.acceptedObservations;
    const remainingDistinctEvents = normalized.distinctEventLimit - operationEventIds.size;
    const remainingTime = normalized.timeoutMs - (Date.now() - startedAt);
    if (remainingObservations <= 0) {
      completionReason = 'observation-budget';
      return false;
    }
    if (remainingDistinctEvents <= 0) {
      completionReason = 'distinct-event-budget';
      return false;
    }
    if (remainingTime <= 0) {
      completionReason = 'timeout';
      return false;
    }
    const requestObservationLimit = Math.min(
      remainingObservations,
      request.observationLimit ?? remainingObservations,
    );
    const requestDistinctEventLimit = Math.min(
      remainingDistinctEvents,
      request.distinctEventLimit ?? remainingDistinctEvents,
    );
    const requestFilterLimit = Math.min(
      requestObservationLimit,
      requestDistinctEventLimit,
    );
    const filter = makeFilter(requestFilterLimit);
    const filterKey = JSON.stringify(filter);
    if (requestedFilters.has(filterKey)) return false;
    requestedFilters.add(filterKey);
    const result = await acquireRelayEvents(memory, {
      relays: normalized.relays,
      filter,
      timeoutMs: Math.max(1, remainingTime),
      observationLimit: requestObservationLimit,
      distinctEventLimit: requestDistinctEventLimit,
      concurrency: normalized.concurrency,
      signal: normalized.signal,
      preserve: protectedEvents,
    });
    for (const key of [
      'receivedPackets', 'invalid', 'acceptedObservations', 'newlyStoredCorpusEvents',
    ]) totals[key] += result.counts[key];
    result.acquiredEventIds.forEach((id) => operationEventIds.add(id));
    totals.distinctEventsAcquired = operationEventIds.size;
    totals.duplicateObservations =
      totals.acceptedObservations - totals.distinctEventsAcquired;
    requests.push({
      purpose: request.purpose ?? 'target-hydration',
      ...(request.subject ? { subject: structuredClone(request.subject) } : {}),
      ...(request.ordering ? { ordering: request.ordering } : {}),
      filter,
      completionReason: result.completionReason,
      counts: structuredClone(result.counts),
      relays: structuredClone(result.relays),
    });
    if (totals.acceptedObservations >= normalized.observationLimit) {
      completionReason = 'observation-budget';
    } else if (operationEventIds.size >= normalized.distinctEventLimit) {
      completionReason = 'distinct-event-budget';
    }
    if (result.completionReason === 'timeout') completionReason = 'timeout';
    if (result.completionReason === 'cancelled') completionReason = 'cancelled';
    return result.counts.newlyStoredCorpusEvents > 0;
  };

  if (normalized.authoredLimit !== undefined) {
    const startingAccounts = startingSubjects.filter(({ type }) => type === 'account');
    for (const account of startingAccounts) {
      if (completionReason !== 'completed') break;
      if (requestedAuthoredAccounts.has(account.id)) continue;
      requestedAuthoredAccounts.add(account.id);
      await acquireFilter(
        (requestLimit) => ({
          authors: [account.id],
          kinds: [1],
          limit: Math.min(normalized.authoredLimit, requestLimit),
        }),
        {
          purpose: 'authored-notes',
          subject: account,
          distinctEventLimit: normalized.authoredLimit,
          ordering: 'relay-recent-created-at-descending',
        },
      );
    }
  }

  // A depth-N traversal can expose a new frontier after each hydration. One
  // extra pass lets evidence fetched for the Nth hop participate in the final
  // traversal without creating an unbounded retry loop or pagination.
  for (let pass = 0; pass <= normalized.depth; pass += 1) {
    const traversed = traverse();
    if (unresolvedBefore === null) {
      unresolvedBefore = unresolvedTargets(memory, traversed);
    }
    const targets = unresolvedTargets(memory, traversed);
    let requested = false;

    const eventIds = targets.events.filter((id) => !requestedEventIds.has(id));
    if (eventIds.length) {
      eventIds.forEach((id) => requestedEventIds.add(id));
      requested = true;
      await acquireFilter(() => ({ ids: eventIds }));
    }

    if (normalized.direction !== 'outbound'
      && normalized.relationshipTypes.some((type) => (
        type === 'reply-parent' || type === 'reply-root'
      ))) {
      const inboundIds = [...new Set(traversed.items
        .filter((item) => (
          item.subject.type === 'event' && traversalItemDepth(item) < normalized.depth
        ))
        .map(({ subject }) => subject.id))]
        .filter((id) => !requestedInboundIds.has(id));
      if (inboundIds.length) {
        inboundIds.forEach((id) => requestedInboundIds.add(id));
        requested = true;
        // The operation-wide remaining observation budget, not target count,
        // bounds reply breadth. This is one bounded request, not pagination.
        await acquireFilter((remaining) => ({
          '#e': inboundIds, kinds: [1], limit: remaining,
        }));
      }
    }

    const accounts = targets.accounts.filter((id) => !requestedAccounts.has(id));
    if (accounts.length) {
      accounts.forEach((id) => requestedAccounts.add(id));
      requested = true;
      await acquireFilter(() => ({ authors: accounts, kinds: [0], limit: accounts.length }));
    }
    if (completionReason !== 'completed' || !requested) break;
  }

  const finalTraversal = traverse();
  const unresolvedAfter = unresolvedTargets(memory, finalTraversal);
  const corpusAfter = memory.describe();
  finalTraversal.context = {
    ...finalTraversal.context,
    expansion: {
      options: publicOptions(normalized),
      startingSubjects,
      corpusBefore,
      corpusAfter,
      requestCount: requests.length,
      filterCount: requestedFilters.size,
      counts: totals,
      requests,
      unresolvedBefore: unresolvedBefore ?? unresolvedAfter,
      unresolvedAfter,
      boundedBy: {
        depth: finalTraversal.context.relationships.some(({ depth }) => depth === normalized.depth),
        traversalLimit: finalTraversal.items.length >= startingSubjects.length + normalized.limit,
        observationBudget: completionReason === 'observation-budget',
        distinctEventBudget: completionReason === 'distinct-event-budget',
        timeout: completionReason === 'timeout',
        cancellation: completionReason === 'cancelled',
      },
      completionReason,
    },
  };
  return finalTraversal;
}

export function normalizeExpansionOptions(memory, selection, options) {
  if (!memory || typeof memory.getEvent !== 'function' || typeof memory.ingest !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  if (typeof memory.asCollection !== 'function' || typeof memory.traverse !== 'function'
    || typeof memory.describe !== 'function') {
    throw new ResearchMemoryError('A bounded in-memory research corpus is required.');
  }
  memory.asCollection(selection);
  if (!isPlainObject(options)) throw new ResearchMemoryError('Expansion options are required.');
  const unknown = Object.keys(options).filter((key) => !OPTION_KEYS.has(key));
  if (unknown.length) {
    throw new ResearchMemoryError(`Unknown expansion options: ${unknown.join(', ')}.`);
  }
  if (!Array.isArray(options.relays) || options.relays.length === 0) {
    throw new ResearchMemoryError('Expansion requires at least one explicit wss:// relay.');
  }
  const relays = options.relays.map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new ResearchMemoryError(`Invalid expansion relay URL: ${value}`);
    }
    if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
      throw new ResearchMemoryError(`Expansion relay must be an explicit wss:// URL: ${value}`);
    }
    return url.href;
  });
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Expansion relay URLs must not be repeated.');
  }
  if (!Array.isArray(options.relationshipTypes) || options.relationshipTypes.length === 0
    || options.relationshipTypes.some((type) => typeof type !== 'string')) {
    throw new ResearchMemoryError('Expansion relationshipTypes must be a non-empty string array.');
  }
  const relationshipTypes = [...new Set(options.relationshipTypes)];
  const unsupported = relationshipTypes.filter((type) => !RELATIONSHIP_TYPES.has(type));
  if (unsupported.length) {
    throw new ResearchMemoryError(
      `Unsupported expansion relationship types: ${unsupported.join(', ')}.`,
    );
  }
  const direction = options.direction ?? 'outbound';
  if (!['inbound', 'outbound', 'both'].includes(direction)) {
    throw new ResearchMemoryError('Expansion direction must be "inbound", "outbound", or "both".');
  }
  const depth = boundedInteger(options.depth ?? 1, 'depth', 1, 100);
  const limit = boundedInteger(options.limit ?? 50, 'limit', 1, 1000);
  const timeoutMs = positiveInteger(options.timeoutMs ?? 10_000, 'timeoutMs');
  const observationLimit = positiveInteger(
    options.observationLimit ?? 100,
    'observationLimit',
  );
  const distinctEventLimit = positiveInteger(
    options.distinctEventLimit ?? 100,
    'distinctEventLimit',
  );
  let authoredLimit;
  if (options.authoredLimit !== undefined) {
    authoredLimit = positiveInteger(options.authoredLimit, 'authoredLimit');
    if (!relationshipTypes.includes('author')) {
      throw new ResearchMemoryError(
        'Expansion authoredLimit requires the "author" relationship.',
      );
    }
    if (direction === 'outbound') {
      throw new ResearchMemoryError(
        'Expansion authoredLimit requires an inbound-capable direction.',
      );
    }
  }
  const concurrency = positiveInteger(options.concurrency ?? 4, 'concurrency');
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ResearchMemoryError('Expansion signal must be an AbortSignal.');
  }
  return {
    relays, relationshipTypes, direction, depth, limit,
    authoredLimit, timeoutMs, observationLimit, distinctEventLimit,
    concurrency, signal: options.signal,
  };
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ResearchMemoryError(`Expansion ${name} must be a positive integer.`);
  }
  return value;
}

function boundedInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ResearchMemoryError(
      `Expansion ${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function publicOptions(options) {
  return {
    relays: options.relays,
    relationshipTypes: options.relationshipTypes,
    direction: options.direction,
    depth: options.depth,
    limit: options.limit,
    ...(options.authoredLimit === undefined ? {} : { authoredLimit: options.authoredLimit }),
    timeoutMs: options.timeoutMs,
    observationLimit: options.observationLimit,
    distinctEventLimit: options.distinctEventLimit,
    concurrency: options.concurrency,
  };
}

function unresolvedTargets(memory, collection) {
  const events = new Set();
  const accounts = new Set();
  for (const { subject } of collection.items) {
    if (subject.type === 'event' && !memory.getEvent(subject.id)) {
      events.add(subject.id);
    } else if (subject.type === 'account') {
      const metadata = memory.currentEvent(subject.id, 0);
      if (!metadata) {
        accounts.add(subject.id);
      }
    }
  }
  return { events: [...events].sort(), accounts: [...accounts].sort() };
}

function traversalItemDepth(item) {
  if (item.role === 'seed') return 0;
  const depths = item.reasons
    .filter((reason) => reason.type === 'relationship')
    .map((reason) => reason.depth);
  return depths.length ? Math.min(...depths) : 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
