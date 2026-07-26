import { acquireRelayEvents, normalizeAcquisitionOptions } from './acquire.js';
import { ResearchMemoryError, subject } from './index.js';
import {
  continuationOutputKind,
  continuationSemantics,
} from './operations.js';
const KEYS = new Set([
  'relationship', 'source', 'relays', 'since', 'until', 'eventLimit', 'depth',
  'timeoutMs', 'observationLimit', 'distinctEventLimit', 'concurrency', 'signal',
]);
const EXTERNAL_KEYS = new Set([
  'relays', 'timeoutMs', 'observationLimit', 'distinctEventLimit', 'concurrency', 'signal',
]);
const MAX_PROJECTION_LIMIT = 1000;

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
      acquisition = await acquireRelayEvents(memory, {
        relays: normalized.relays,
        filter,
        timeoutMs: normalized.timeoutMs,
        observationLimit: normalized.observationLimit,
        distinctEventLimit: normalized.distinctEventLimit,
        concurrency: normalized.concurrency,
        signal: normalized.signal,
      });
    }
  }

  const projection = projectByInput(memory, starts, normalized, acquisition);
  const collection = memory.collection(projection.items, {
    operation: 'continuation',
    relationship: normalized.relationship,
    source: normalized.source,
    starts: starts.items.map(({ subject: itemSubject }) => itemSubject),
    limit: normalized.eventLimit,
  }, continuationOutputKind(normalized.relationship));
  const projectionBoundReached = projection.boundReached;
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
  const source = options.source ?? 'local';
  if (!['local', 'relays'].includes(source)) {
    throw new ResearchMemoryError('Continuation source must be "local" or "relays".');
  }
  const eventLimit = boundedInteger(options.eventLimit ?? 50, 'eventLimit', 1, 1000);
  const depth = boundedInteger(options.depth ?? 3, 'depth', 1, 100);
  const result = { relationship: options.relationship, source, eventLimit, depth };
  for (const name of ['since', 'until']) {
    if (options[name] !== undefined) result[name] = boundedInteger(options[name], name, 0);
  }
  if (result.since !== undefined && result.until !== undefined && result.since > result.until) {
    throw new ResearchMemoryError('Continuation since must not be later than until.');
  }
  if (source === 'relays') {
    if (!continuationSemantics(options.relationship).external) {
      throw new ResearchMemoryError(
        'Unsupported external continuation relationship: linked-domains has no NIP-01 filter.',
      );
    }
    if (!Array.isArray(options.relays) || options.relays.length === 0) {
      throw new ResearchMemoryError('Relay continuation requires explicit relays.');
    }
    const acquisition = normalizeAcquisitionOptions({
      relays: options.relays,
      filter: { limit: 1 },
      timeoutMs: positiveInteger(options.timeoutMs ?? 10_000, 'timeoutMs'),
      observationLimit: positiveInteger(options.observationLimit ?? 100, 'observationLimit'),
      distinctEventLimit: positiveInteger(
        options.distinctEventLimit ?? 100, 'distinctEventLimit',
      ),
      concurrency: positiveInteger(options.concurrency ?? 4, 'concurrency'),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    Object.assign(result, {
      relays: acquisition.relays,
      timeoutMs: acquisition.timeoutMs,
      observationLimit: acquisition.observationLimit,
      distinctEventLimit: acquisition.distinctEventLimit,
      concurrency: acquisition.concurrency,
      ...(acquisition.signal === undefined ? {} : { signal: acquisition.signal }),
    });
    // Delegate URL, signal, and acquisition-budget validation to the acquisition boundary.
    const unexpected = Object.keys(result).filter((key) => (
      !KEYS.has(key) && !EXTERNAL_KEYS.has(key)
    ));
    if (unexpected.length) throw new ResearchMemoryError('Invalid continuation acquisition options.');
  } else if (options.relays !== undefined || options.timeoutMs !== undefined
      || options.observationLimit !== undefined || options.distinctEventLimit !== undefined
      || options.concurrency !== undefined || options.signal !== undefined) {
    throw new ResearchMemoryError('Local continuation does not accept relay acquisition options.');
  }
  return result;
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
  if (options.relationship === 'expansion' && accounts.length) {
    return memory.traverse(accounts, {
      relationshipTypes: traversalFor('expansion').types,
      direction: 'both',
      depth: options.depth,
      limit: projectionLimit(options.eventLimit),
    });
  }

  const traversal = traversalFor(options.relationship);
  return memory.traverse(events, {
    relationshipTypes: traversal.types,
    direction: traversal.direction,
    depth: options.relationship === 'conversation' || options.relationship === 'expansion'
      ? options.depth : 1,
    limit: projectionLimit(options.eventLimit),
  });
}

function projectionLimit(eventLimit) {
  return eventLimit < MAX_PROJECTION_LIMIT ? eventLimit + 1 : MAX_PROJECTION_LIMIT;
}

function traversalFor(relationship) {
  const map = {
    replies: { types: ['reply-root', 'reply-parent'], direction: 'inbound' },
    ancestors: { types: ['reply-root', 'reply-parent'], direction: 'outbound' },
    mentions: { types: ['mentioned-event'], direction: 'both' },
    quotes: { types: ['quoted-event'], direction: 'both' },
    'referenced-events': {
      types: ['reply-root', 'reply-parent', 'mentioned-event', 'quoted-event'],
      direction: 'outbound',
    },
    conversation: { types: ['reply-root', 'reply-parent'], direction: 'both' },
    expansion: {
      types: [
        'author', 'reply-root', 'reply-parent', 'mentioned-event', 'quoted-event',
        'mentioned-account', 'follow', 'topic', 'other-tag',
      ],
      direction: 'both',
    },
  };
  return map[relationship] ?? { types: [], direction: 'outbound' };
}

function continuationFilter(memory, starts, options) {
  const accounts = starts.items.filter(({ subject: item }) => item.type === 'account')
    .map(({ subject: item }) => item.id);
  const events = starts.items.filter(({ subject: item }) => item.type === 'event')
    .map(({ subject: item }) => item.id);
  const base = {
    limit: options.eventLimit,
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
  if (options.relationship === 'expansion' && accounts.length && !events.length) {
    return { ...base, authors: accounts };
  }
  if (['replies', 'conversation', 'mentions', 'quotes', 'expansion'].includes(
    options.relationship,
  )) return events.length ? { ...base, '#e': events } : null;
  const referenced = memory.traverse(events, {
    relationshipTypes: traversalFor(options.relationship).types,
    direction: 'outbound', depth: 1, limit: 1000,
  }).items.filter(({ subject: item }) => item.type === 'event')
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
    const status = candidateCount ? (externalPartial ? 'partial-external-resolution' : 'resolved')
      : externalPartial ? 'partial-external-resolution' : 'empty-valid-result';
    const outcome = { subject: startSubject, status, resultCount: candidateCount };
    outcomes.push({ outcome, candidateKeys });
    if (status !== 'resolved') omissions.push({ subject: startSubject, reason: status });
  }

  const candidates = [...merged.entries()];
  const retained = candidates.slice(0, options.eventLimit);
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
      status: externalPartial ? 'partial-external-resolution' : 'event-limit',
      resultCount,
      omittedCount,
    };
  });
  const boundReached = candidates.length > options.eventLimit
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
