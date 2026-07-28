import { acquireBoundAccountEvents, acquireRelayEvents, normalizeAcquisitionOptions } from './acquire.js';
import { ACQUISITION, CONTINUATION, RESULT_LIMIT } from './contract-facts.js';
import { ResearchMemoryError, subject } from './protocol.js';
import {
  continuationOutputKind,
  continuationSemantics,
} from './operations.js';
import {
  CONVERSATION_RELATIONSHIP_TYPES,
  EVENT_REFERENCE_RELATIONSHIP_TYPES,
} from './protocol-relationships.js';
const KEYS = new Set([
  'relationship', 'source', 'relays', 'since', 'until', 'offset', 'eventLimit', 'depth',
  'timeoutMs', 'observationLimit', 'distinctEventLimit', 'concurrency',
  'excludeContentWarnings', 'signal',
]);
const MAX_PROJECTION_LIMIT = RESULT_LIMIT.maximum;

/**
 * Continue a supplied result collection through one named Nostr relationship.
 *
 * Both local and relay-backed use the same command. Relay-backed continuations
 * first acquire a protocol slice into the shared corpus, then evaluate exactly
 * the same local relationship projection.
 */
export async function continueResearch(memory, input, options) {
  const normalized = normalizeContinuation(memory, input, options);
  const starts = memory.asCollection(input);
  let acquisition = null;

  if (normalized.source === 'relays') {
    const filter = continuationFilter(memory, starts, normalized);
    if (filter) {
      acquisition = await acquireContinuationEvidence(memory, starts, normalized, filter);
    }
  }

  const projection = projectByInput(memory, starts, normalized, acquisition);
  const projectionBoundReached = projection.boundReached;
  const collection = memory.collection(projection.items, {
    operation: 'continuation',
    relationship: normalized.relationship,
    source: normalized.source,
    starts: starts.items.map(({ subject: itemSubject }) => itemSubject),
    offset: normalized.offset,
    limit: normalized.eventLimit,
    cardinality: {
      outputCount: projection.items.length,
      outputLimit: normalized.eventLimit,
      truncated: projectionBoundReached,
    },
  }, continuationOutputKind(normalized.relationship));
  const externalPartial = acquisition && acquisition.completionReason !== 'completed';
  const unresolved = projection.omissions.some(
    ({ reason }) => reason !== 'empty-valid-result',
  );
  const completeness = {
    status: externalPartial || projectionBoundReached || unresolved ? 'partial'
      : collection.items.length ? 'complete' : 'empty',
    scope: normalized.source === 'local' ? 'resident-corpus' : 'bounded-relay-attempt',
    exhaustive: normalized.source === 'local' && !projectionBoundReached,
    emptyValidResult: collection.items.length === 0 && projection.omissions.every(
      ({ reason }) => reason === 'empty-valid-result',
    ),
    inputs: projection.inputs,
    omissions: projection.omissions,
    boundsReached: [
      ...(projectionBoundReached ? ['event-limit'] : []),
      ...(externalPartial ? [acquisition.completionReason] : []),
    ],
  };
  collection.context.completeness = structuredClone(completeness);

  if (!acquisition) return { type: 'continuation-report', collection, completeness };
  return {
    type: 'continuation-report',
    collection,
    completeness,
    completionReason: acquisition.completionReason,
    counts: acquisition.counts,
    coverage: acquisition.coverage,
    requested: acquisition.requested,
    budget: acquisition.budget,
    acquiredEventIds: acquisition.acquiredEventIds,
    additions: acquisition.additions,
    corpusBefore: acquisition.corpusBefore,
    corpusAfter: acquisition.corpusAfter,
  };
}

/**
 * One lowered relay attempt used by relationship continuation and the direct
 * profile hydration operation. Callers choose the exact relationship kinds;
 * this boundary owns author binding and acquisition accounting.
 */
export async function acquireContinuationEvidence(
  memory,
  input,
  options,
  preparedFilter = undefined,
) {
  const starts = memory.asCollection(input);
  const authors = [...new Set(starts.items
    .filter(({ subject: item }) => item.type === 'account')
    .map(({ subject: item }) => item.id))];
  const filter = preparedFilter ?? {
    authors,
    kinds: options.kinds,
    ...(options.eventLimit === undefined ? {} : { limit: options.eventLimit }),
  };
  if (filter === null) throw new ResearchMemoryError('Continuation has no bindable input subjects.');
  if (authors.length) return acquireBoundAccountEvents(memory, starts, options, filter);
  return acquireRelayEvents(memory, {
    relays: options.relays, filter, timeoutMs: options.timeoutMs,
    observationLimit: options.observationLimit,
    distinctEventLimit: options.distinctEventLimit,
    concurrency: options.concurrency,
    excludeContentWarnings: options.excludeContentWarnings,
    signal: options.signal,
  });
}

export function normalizeContinuation(memory, input, options) {
  if (!memory || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  const collection = memory.asCollection(input);
  if (!isPlainObject(options)) {
    throw new ResearchMemoryError('Continuation parameters must be a plain object.');
  }
  const unknown = Object.keys(options).filter((key) => !KEYS.has(key));
  if (unknown.length) {
    throw new ResearchMemoryError(`Unknown continuation parameters: ${unknown.join(', ')}.`);
  }
  if (!continuationSemantics(options.relationship)) {
    throw new ResearchMemoryError(`Unsupported continuation relationship: ${options.relationship}.`);
  }
  if (!continuationSemantics(options.relationship).inputKinds.includes(collection.kind)) {
    throw new ResearchMemoryError(
      `Continuation relationship ${options.relationship} does not accept ${collection.kind} collections.`,
    );
  }
  const source = options.source ?? CONTINUATION.source.default;
  if (!CONTINUATION.source.values.includes(source)) {
    throw new ResearchMemoryError('Continuation source must be "local" or "relays".');
  }
  const eventLimit = boundedInteger(
    options.eventLimit ?? CONTINUATION.eventLimit.default,
    'eventLimit',
    CONTINUATION.eventLimit.minimum,
    CONTINUATION.eventLimit.maximum,
  );
  const offset = boundedInteger(
    options.offset ?? CONTINUATION.offset.default,
    'offset',
    CONTINUATION.offset.minimum,
    CONTINUATION.offset.maximum,
  );
  const depth = boundedInteger(
    options.depth ?? CONTINUATION.depth.default,
    'depth',
    CONTINUATION.depth.minimum,
    CONTINUATION.depth.maximum,
  );
  const result = { relationship: options.relationship, source, offset, eventLimit, depth };
  for (const name of ['since', 'until']) {
    if (options[name] !== undefined) result[name] = boundedInteger(options[name], name, 0);
  }
  if (result.since !== undefined && result.until !== undefined && result.since > result.until) {
    throw new ResearchMemoryError('Continuation since must not be later than until.');
  }
  if (source === 'relays') {
    if (!continuationSemantics(options.relationship).external) {
      throw new ResearchMemoryError(
        `Unsupported external continuation relationship: ${options.relationship} has no NIP-01 filter.`,
      );
    }
    if (!Array.isArray(options.relays) || options.relays.length === 0) {
      throw new ResearchMemoryError('Relay continuation requires explicit relays.');
    }
    const acquisition = normalizeAcquisitionOptions({
      relays: options.relays,
      filter: { limit: 1 },
      timeoutMs: positiveInteger(
        options.timeoutMs ?? ACQUISITION.timeoutMs.default,
        'timeoutMs',
      ),
      observationLimit: positiveInteger(
        options.observationLimit
          ?? ACQUISITION.observationLimit.default,
        'observationLimit',
      ),
      distinctEventLimit: positiveInteger(
        options.distinctEventLimit
          ?? ACQUISITION.distinctEventLimit.default,
        'distinctEventLimit',
      ),
      concurrency: positiveInteger(
        options.concurrency ?? ACQUISITION.concurrency.default,
        'concurrency',
      ),
      excludeContentWarnings: boolean(
        options.excludeContentWarnings ?? ACQUISITION.excludeContentWarnings.default,
        'excludeContentWarnings',
      ),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    Object.assign(result, {
      relays: acquisition.relays,
      timeoutMs: acquisition.timeoutMs,
      observationLimit: acquisition.observationLimit,
      distinctEventLimit: acquisition.distinctEventLimit,
      concurrency: acquisition.concurrency,
      excludeContentWarnings: acquisition.excludeContentWarnings,
      ...(acquisition.signal === undefined ? {} : { signal: acquisition.signal }),
    });
  } else if (options.relays !== undefined || options.timeoutMs !== undefined
      || options.observationLimit !== undefined || options.distinctEventLimit !== undefined
      || options.concurrency !== undefined || options.excludeContentWarnings !== undefined
      || options.signal !== undefined) {
    throw new ResearchMemoryError('Local continuation does not accept relay acquisition options.');
  }
  return result;
}

function boolean(value, name) {
  if (typeof value !== 'boolean') throw new ResearchMemoryError(`${name} must be a boolean.`);
  return value;
}

function localContinuation(memory, starts, options) {
  const accounts = starts.items.filter(({ subject: item }) => item.type === 'account')
    .map(({ subject: item }) => item);
  const events = starts.items.filter(({ subject: item }) => item.type === 'event')
    .map(({ subject: item }) => item);
  const query = {
    limit: projectionLimit(options.eventLimit),
    ...(options.since === undefined ? {} : { since: options.since }),
    ...(options.until === undefined ? {} : { until: options.until }),
  };
  if (options.relationship === 'authored-notes') {
    return accounts.length
      ? memory.select({ ...query, authors: accounts.map(({ id }) => id), kinds: [1] })
      : memory.collection([], { operation: 'continuation-projection' });
  }
  if (options.relationship === 'profiles' || options.relationship === 'follow-lists') {
    return accounts.length ? memory.select({
      ...query, authors: accounts.map(({ id }) => id),
      kinds: [options.relationship === 'profiles' ? 0 : 3],
    }) : memory.collection([], { operation: 'continuation-projection' });
  }
  if (options.relationship === 'followed-accounts') {
    return mergeCollections(memory, accounts.map((account) => memory.follows(account)));
  }
  if (options.relationship === 'followers') {
    const contactLists = memory.select({
      ...query, kinds: [3], '#p': accounts.map(({ id }) => id),
    });
    return memory.collection(contactLists.items.map((item) => ({
      subject: subject('account', item.record.event.pubkey),
      reasons: [{
        type: 'relationship',
        relationshipType: 'evidence-backed-follower',
        sourceEventId: item.subject.id,
        targetAccounts: accounts,
      }],
    })), { operation: 'continuation-projection' });
  }
  if (options.relationship === 'shared-tags') return sharedTags(memory, events, query);
  if (options.relationship === 'linked-domains') return linkedDomainEvents(memory, events, query);
  const traversal = traversalFor(options.relationship);
  const traversed = memory.traverse(events, {
    relationshipTypes: traversal.types,
    direction: traversal.direction,
    depth: options.relationship === 'conversation' ? options.depth : 1,
    limit: projectionLimit(options.eventLimit),
  });
  if (options.relationship === 'conversation') return traversed;
  const startKeys = new Set(events.map(({ type, id }) => `${type}:${id}`));
  return memory.collection(traversed.items.filter(({ subject: item }) => (
    !startKeys.has(`${item.type}:${item.id}`)
  )), {
    operation: 'continuation-projection',
    relationship: options.relationship,
  });
}

function projectionLimit(eventLimit) {
  return eventLimit < MAX_PROJECTION_LIMIT ? eventLimit + 1 : MAX_PROJECTION_LIMIT;
}

function traversalFor(relationship) {
  const map = {
    replies: { types: CONVERSATION_RELATIONSHIP_TYPES, direction: 'inbound' },
    ancestors: { types: CONVERSATION_RELATIONSHIP_TYPES, direction: 'outbound' },
    mentions: { types: ['mentioned-event'], direction: 'both' },
    quotes: { types: ['quoted-event'], direction: 'both' },
    'referenced-events': {
      types: EVENT_REFERENCE_RELATIONSHIP_TYPES,
      direction: 'outbound',
    },
    conversation: { types: CONVERSATION_RELATIONSHIP_TYPES, direction: 'both' },
  };
  return map[relationship] ?? { types: [], direction: 'outbound' };
}

function continuationFilter(memory, starts, options) {
  const accounts = starts.items.filter(({ subject: item }) => item.type === 'account')
    .map(({ subject: item }) => item.id);
  const eventSubjects = starts.items.filter(({ subject: item }) => item.type === 'event')
    .map(({ subject: item }) => item);
  const eventIds = eventSubjects.map(({ id }) => id);
  const base = {
    // The relay request may need more candidates than the final global
    // projection window so one prolific input cannot consume every slot.
    limit: Math.min(
      MAX_PROJECTION_LIMIT,
      options.eventLimit * Math.max(1, starts.items.length),
    ),
    ...(options.since === undefined ? {} : { since: options.since }),
    ...(options.until === undefined ? {} : { until: options.until }),
  };
  if (options.relationship === 'authored-notes') {
    return accounts.length ? { ...base, authors: accounts, kinds: [1] } : null;
  }
  if (options.relationship === 'profiles') {
    return accounts.length ? { ...base, authors: accounts, kinds: [0] } : null;
  }
  if (options.relationship === 'follow-lists'
      || options.relationship === 'followed-accounts') {
    return accounts.length ? { ...base, authors: accounts, kinds: [3] } : null;
  }
  if (options.relationship === 'followers') {
    return accounts.length ? { ...base, '#p': accounts, kinds: [3] } : null;
  }
  if (['replies', 'conversation', 'mentions', 'quotes'].includes(
    options.relationship,
  )) return eventIds.length ? { ...base, '#e': eventIds } : null;
  const referenced = memory.traverse(eventSubjects, {
    relationshipTypes: traversalFor(options.relationship).types,
    direction: 'outbound', depth: 1, limit: 1000,
  }).items.filter(({ subject: item, role }) => item.type === 'event' && role !== 'seed')
    .map(({ subject: item }) => item.id);
  return referenced.length ? { ...base, ids: referenced } : null;
}

function inputIssue(memory, item, relationship) {
  const supportedTypes = continuationSemantics(relationship).inputKinds
    .flatMap((kind) => kind === 'subjects' ? ['account', 'event']
      : kind === 'accounts' ? ['account'] : ['event']);
  const supported = supportedTypes.includes(item.type);
  if (!supported) return 'unsupported-subject-type';
  if (item.type === 'event' && !memory.getEvent(item.id)) return 'absent-local-evidence';
  if (relationship === 'followed-accounts') {
    const follows = memory.follows(item);
    if (follows.items.length === 0 && follows.context.currentContactListEventId === null) {
      return 'absent-local-evidence';
    }
  }
  return null;
}

function projectByInput(memory, starts, options, acquisition) {
  const merged = new Map();
  const outcomes = [];
  const omissions = [];
  const externalPartial = acquisition && acquisition.completionReason !== 'completed';

  for (const start of starts.items) {
    const startSubject = start.subject;
    const issue = inputIssue(memory, startSubject, options.relationship);
    if (issue) {
      const outcome = { subject: startSubject, status: issue, resultCount: 0 };
      outcomes.push({ outcome, candidateKeys: new Set() });
      omissions.push({ subject: startSubject, reason: issue });
      continue;
    }
    const scoped = memory.collection([start], { operation: 'continuation-input' });
    const projected = localContinuation(memory, scoped, options);
    const candidateKeys = new Set();
    for (const item of projected.items) {
      const key = `${item.subject.type}:${item.subject.id}`;
      candidateKeys.add(key);
      const reason = {
        type: 'continuation',
        relationship: options.relationship,
        start: startSubject,
        source: options.source,
      };
      const existing = merged.get(key);
      if (existing) {
        existing.reasons.push(...(item.reasons ?? []), reason);
      } else {
        merged.set(key, {
          ...item,
          reasons: [...(item.reasons ?? []), reason],
        });
      }
    }
    const candidateCount = candidateKeys.size;
    const status = candidateCount ? (externalPartial ? 'partial-external-match' : 'matched')
      : externalPartial ? 'partial-external-match' : 'empty-valid-result';
    const outcome = { subject: startSubject, status, resultCount: candidateCount };
    outcomes.push({ outcome, candidateKeys });
    if (status !== 'matched') omissions.push({ subject: startSubject, reason: status });
  }

  // Preserve the global bound while giving each explicit input a chance to
  // contribute before a prolific earlier input contributes its next result.
  const candidates = [];
  const retainedCandidateKeys = new Set();
  const candidateLists = outcomes.map(({ candidateKeys }) => [...candidateKeys]);
  for (let index = 0; candidateLists.some((items) => index < items.length); index += 1) {
    for (const items of candidateLists) {
      const key = items[index];
      if (key !== undefined && !retainedCandidateKeys.has(key)) {
        retainedCandidateKeys.add(key);
        candidates.push([key, merged.get(key)]);
      }
    }
  }
  const retained = candidates.slice(options.offset, options.offset + options.eventLimit);
  const retainedKeys = new Set(retained.map(([key]) => key));
  const inputs = outcomes.map(({ outcome, candidateKeys }) => {
    if (candidateKeys.size === 0) return outcome;
    const resultCount = [...candidateKeys].filter((key) => retainedKeys.has(key)).length;
    const omittedCount = candidateKeys.size - resultCount;
    if (omittedCount === 0) return { ...outcome, resultCount };
    omissions.push({
      subject: outcome.subject,
      reason: 'event-limit',
      omittedCount,
    });
    return {
      ...outcome,
      status: externalPartial ? 'partial-external-match' : 'event-limit',
      resultCount,
      omittedCount,
    };
  });
  const boundReached = options.offset > 0
    || candidates.length > options.offset + options.eventLimit
    || (options.eventLimit === MAX_PROJECTION_LIMIT
      && candidates.length === MAX_PROJECTION_LIMIT);
  return { items: retained.map(([, item]) => item), inputs, omissions, boundReached };
}

function sharedTags(memory, events, query) {
  const counts = new Map();
  for (const item of events) {
    const event = memory.getEvent(item.id)?.event;
    for (const tag of event?.tags ?? []) {
      if (tag[0] === 't' && tag[1]) counts.set(tag[1], (counts.get(tag[1]) ?? 0) + 1);
    }
  }
  const tags = [...counts].filter(([, count]) => count >= Math.min(2, events.length))
    .map(([value]) => value);
  return tags.length ? memory.select({ ...query, '#t': tags })
    : memory.collection([], { operation: 'continuation-projection' });
}

function linkedDomainEvents(memory, events, query) {
  const domains = new Set(events.flatMap(({ id }) => domainsIn(
    memory.getEvent(id)?.event.content ?? '',
  )));
  if (!domains.size) return memory.collection([], { operation: 'continuation-projection' });
  const candidates = memory.select(query);
  return memory.collection(candidates.items.filter(({ record }) => (
    domainsIn(record.event.content).some((domain) => domains.has(domain))
  )), { operation: 'continuation-projection' });
}

function domainsIn(text) {
  return [...text.matchAll(/https?:\/\/[^\s<>"']+/giu)].flatMap((match) => {
    try { return [new URL(match[0]).hostname.toLocaleLowerCase()]; } catch { return []; }
  });
}

function mergeCollections(memory, collections) {
  const items = new Map();
  for (const collection of collections) {
    for (const item of collection.items) {
      const key = `${item.subject.type}:${item.subject.id}`;
      if (!items.has(key)) items.set(key, item);
    }
  }
  return memory.collection([...items.values()], { operation: 'continuation-projection' });
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ResearchMemoryError(`Continuation ${name} must be a positive integer.`);
  }
  return value;
}

function boundedInteger(value, name, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ResearchMemoryError(
      `Continuation ${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object'
    && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
