import { acquireRelayEvents } from './acquire.js';
import { ResearchMemoryError, subject } from './index.js';

const OPTION_KEYS = new Set([
  'relays', 'authoredLimit', 'parentLimit', 'timeoutMs',
  'observationLimit', 'distinctEventLimit', 'concurrency', 'signal',
]);

/** Acquires authored replies and resolves each direct parent within shared bounds. */
export async function resolveReplyContexts(memory, accounts, options) {
  const normalized = normalizeReplyContextOptions(memory, accounts, options);
  const startedAt = Date.now();
  const requests = [];
  const totals = {
    receivedPackets: 0, invalid: 0, acceptedObservations: 0,
    duplicateObservations: 0, newlyStoredCorpusEvents: 0,
    distinctEventsAcquired: 0,
  };
  const operationEventIds = new Set();
  const authoredIds = new Set();
  let completionReason = 'completed';

  const acquire = async (filter, purpose, details = {}) => {
    const remainingObservations = normalized.observationLimit - totals.acceptedObservations;
    const remainingDistinctEvents = normalized.distinctEventLimit - operationEventIds.size;
    const remainingTime = normalized.timeoutMs - (Date.now() - startedAt);
    if (remainingObservations <= 0) {
      completionReason = 'observation-budget';
      return null;
    }
    if (remainingDistinctEvents <= 0) {
      completionReason = 'distinct-event-budget';
      return null;
    }
    if (remainingTime <= 0) {
      completionReason = 'timeout';
      return null;
    }
    const requestObservationLimit = Math.min(
      remainingObservations,
      details.observationLimit ?? remainingObservations,
    );
    const requestDistinctEventLimit = Math.min(
      remainingDistinctEvents,
      details.distinctEventLimit ?? remainingDistinctEvents,
    );
    const boundedFilter = {
      ...filter,
      limit: Math.min(filter.limit ?? requestDistinctEventLimit, requestDistinctEventLimit),
    };
    const result = await acquireRelayEvents(memory, {
      relays: normalized.relays,
      filter: boundedFilter,
      timeoutMs: Math.max(1, remainingTime),
      observationLimit: requestObservationLimit,
      distinctEventLimit: requestDistinctEventLimit,
      concurrency: normalized.concurrency,
      signal: normalized.signal,
    });
    for (const key of [
      'receivedPackets', 'invalid', 'acceptedObservations', 'newlyStoredCorpusEvents',
    ]) totals[key] += result.counts[key];
    result.acquiredEventIds.forEach((id) => operationEventIds.add(id));
    totals.distinctEventsAcquired = operationEventIds.size;
    totals.duplicateObservations =
      totals.acceptedObservations - totals.distinctEventsAcquired;
    requests.push({
      purpose,
      ...details.report,
      filter: boundedFilter,
      completionReason: result.completionReason,
      counts: structuredClone(result.counts),
      relays: structuredClone(result.relays),
    });
    if (totals.acceptedObservations >= normalized.observationLimit) {
      completionReason = 'observation-budget';
    } else if (operationEventIds.size >= normalized.distinctEventLimit) {
      completionReason = 'distinct-event-budget';
    } else if (['timeout', 'cancelled'].includes(result.completionReason)) {
      completionReason = result.completionReason;
    }
    return result;
  };

  for (const account of normalized.accounts) {
    if (completionReason !== 'completed') break;
    const result = await acquire(
      { authors: [account.id], kinds: [1], limit: normalized.authoredLimit },
      'authored-replies',
      {
        distinctEventLimit: normalized.authoredLimit,
        report: {
          subject: account,
          ordering: 'relay-recent-created-at-descending',
        },
      },
    );
    for (const eventId of result?.acquiredEventIds ?? []) {
      const event = memory.getEvent(eventId)?.event;
      if (event?.kind === 1 && event.pubkey === account.id) authoredIds.add(eventId);
    }
  }

  const replies = [...authoredIds]
    .map((id) => memory.getEvent(id))
    .filter(Boolean)
    .sort((left, right) => (
      right.event.created_at - left.event.created_at
      || left.event.id.localeCompare(right.event.id)
    ))
    .map((record) => {
      const traversal = memory.traverse([subject('event', record.event.id)], {
        relationshipTypes: ['reply-parent'],
        direction: 'outbound',
        depth: 1,
        limit: 10,
      });
      const relationship = traversal.context.relationships
        .filter((edge) => (
          edge.sourceEventId === record.event.id && edge.type === 'reply-parent'
        ))
        .sort((left, right) => (
          (left.evidence.tagIndex ?? 0) - (right.evidence.tagIndex ?? 0)
          || left.target.id.localeCompare(right.target.id)
        ))[0];
      return relationship ? { record, relationship } : null;
    })
    .filter(Boolean);

  const distinctParentIds = [...new Set(replies.map(({ relationship }) => relationship.target.id))];
  const missingParentIds = distinctParentIds.filter((id) => !memory.getEvent(id));
  const parentTargets = missingParentIds.slice(0, normalized.parentLimit);
  let requestedParentIds = [];
  if (parentTargets.length && completionReason === 'completed') {
    requestedParentIds = parentTargets;
    await acquire(
      { ids: requestedParentIds },
      'reply-parents',
      { report: { subjects: requestedParentIds.map((id) => subject('event', id)) } },
    );
  }

  const requestedParents = new Set(requestedParentIds);
  const targetedParents = new Set(parentTargets);
  const contexts = replies.map(({ record, relationship }) => {
    const replyItem = eventItem(record, [{
      type: 'authored-reply',
      account: subject('account', record.event.pubkey),
      relationship: relationshipEvidence(relationship),
    }]);
    const parentRecord = memory.getEvent(relationship.target.id);
    const parentReason = {
      type: 'reply-parent',
      reply: replyItem.subject,
      relationship: relationshipEvidence(relationship),
    };
    let unresolvedReason;
    if (!parentRecord) {
      if (!requestedParents.has(relationship.target.id)) {
        if (!targetedParents.has(relationship.target.id)) unresolvedReason = 'parent-limit';
        else if (completionReason === 'timeout') unresolvedReason = 'timeout';
        else if (completionReason === 'cancelled') unresolvedReason = 'cancelled';
        else if (completionReason === 'observation-budget') unresolvedReason = 'observation-budget';
        else if (completionReason === 'distinct-event-budget') {
          unresolvedReason = 'distinct-event-budget';
        }
        else unresolvedReason = 'not-requested';
      } else if (completionReason === 'timeout') unresolvedReason = 'timeout';
      else if (completionReason === 'cancelled') unresolvedReason = 'cancelled';
      else if (completionReason === 'observation-budget') unresolvedReason = 'observation-budget';
      else if (completionReason === 'distinct-event-budget') {
        unresolvedReason = 'distinct-event-budget';
      }
      else unresolvedReason = 'unavailable';
    }
    return {
      reply: replyItem,
      parent: parentRecord
        ? { status: 'resolved', ...eventItem(parentRecord, [parentReason]) }
        : {
          status: 'unresolved',
          subject: structuredClone(relationship.target),
          reasons: [{ ...parentReason, unresolvedReason }],
          provenance: [],
          unresolvedReason,
        },
      relationship: relationshipEvidence(relationship),
    };
  });

  const items = [];
  const seenItems = new Map();
  for (const context of contexts) {
    mergeItem(seenItems, items, context.reply);
    if (context.parent.status === 'resolved') mergeItem(seenItems, items, context.parent);
  }
  const unresolvedParents = contexts
    .filter(({ parent }) => parent.status === 'unresolved')
    .map(({ reply, parent }) => ({
      reply: structuredClone(reply.subject),
      parent: structuredClone(parent.subject),
      reason: parent.unresolvedReason,
    }));
  const report = {
    options: publicOptions(normalized),
    startingAccounts: normalized.accounts,
    requestCount: requests.length,
    counts: totals,
    requests,
    authoredNoteCount: authoredIds.size,
    replyCount: contexts.length,
    distinctParentCount: distinctParentIds.length,
    resolvedParentCount: new Set(contexts
      .filter(({ parent }) => parent.status === 'resolved')
      .map(({ parent }) => parent.subject.id)).size,
    requestedParentCount: requestedParentIds.length,
    unresolvedParentCount: unresolvedParents.length,
    unresolvedParents,
    boundedBy: {
      authoredLimit: requests.some(({ purpose, counts }) => (
        purpose === 'authored-replies'
        && counts.distinctEventsAcquired >= normalized.authoredLimit
      )),
      parentLimit: missingParentIds.length > normalized.parentLimit,
      observationBudget: completionReason === 'observation-budget',
      distinctEventBudget: completionReason === 'distinct-event-budget',
      timeout: completionReason === 'timeout',
      cancellation: completionReason === 'cancelled',
    },
    completionReason,
  };
  const collection = memory.collection(items, {
    operation: 'reply-contexts',
    replyContexts: report,
  });
  return { type: 'reply-contexts', contexts, collection, report };
}

export function normalizeReplyContextOptions(memory, accounts, options) {
  if (!memory || typeof memory.getEvent !== 'function' || typeof memory.ingest !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  if (typeof memory.collection !== 'function' || typeof memory.asCollection !== 'function') {
    throw new ResearchMemoryError('A bounded in-memory research corpus is required.');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ResearchMemoryError('Reply-context options are required.');
  }
  const unknown = Object.keys(options).filter((key) => !OPTION_KEYS.has(key));
  if (unknown.length) {
    throw new ResearchMemoryError(`Unknown reply-context options: ${unknown.join(', ')}.`);
  }
  if (!Array.isArray(options.relays) || options.relays.length === 0) {
    throw new ResearchMemoryError('Reply contexts require at least one explicit wss:// relay.');
  }
  const relays = options.relays.map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new ResearchMemoryError(`Invalid reply-context relay URL: ${value}`);
    }
    if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
      throw new ResearchMemoryError(`Reply-context relay must be an explicit wss:// URL: ${value}`);
    }
    return url.href;
  });
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Reply-context relay URLs must not be repeated.');
  }
  const input = accounts?.type === 'result-collection'
    ? memory.asCollection(accounts).items.map(({ subject: item }) => item)
    : Array.isArray(accounts) ? accounts : [accounts];
  if (!input.length || input.some((item) => item?.type !== 'account')) {
    throw new ResearchMemoryError('Reply contexts require explicit account subjects only.');
  }
  const normalizedAccounts = [];
  const seen = new Set();
  for (const item of input) {
    const normalized = subject('account', item.id);
    if (!seen.has(normalized.id)) {
      seen.add(normalized.id);
      normalizedAccounts.push(normalized);
    }
  }
  const authoredLimit = positiveInteger(options.authoredLimit ?? 20, 'authoredLimit');
  const parentLimit = positiveInteger(options.parentLimit ?? 20, 'parentLimit');
  const timeoutMs = positiveInteger(options.timeoutMs ?? 10_000, 'timeoutMs');
  const observationLimit = positiveInteger(
    options.observationLimit ?? 100,
    'observationLimit',
  );
  const distinctEventLimit = positiveInteger(
    options.distinctEventLimit ?? 100,
    'distinctEventLimit',
  );
  const concurrency = positiveInteger(options.concurrency ?? 4, 'concurrency');
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ResearchMemoryError('Reply-context signal must be an AbortSignal.');
  }
  return {
    relays, accounts: normalizedAccounts, authoredLimit, parentLimit,
    timeoutMs, observationLimit, distinctEventLimit, concurrency, signal: options.signal,
  };
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ResearchMemoryError(`Reply-context ${name} must be a positive integer.`);
  }
  return value;
}

function publicOptions(options) {
  return {
    relays: options.relays,
    authoredLimit: options.authoredLimit,
    parentLimit: options.parentLimit,
    timeoutMs: options.timeoutMs,
    observationLimit: options.observationLimit,
    distinctEventLimit: options.distinctEventLimit,
    concurrency: options.concurrency,
  };
}

function eventItem(record, reasons) {
  return {
    subject: subject('event', record.event.id),
    record: structuredClone(record),
    reasons,
    provenance: structuredClone(record.observations),
  };
}

function relationshipEvidence(relationship) {
  return {
    type: relationship.type,
    sourceEventId: relationship.sourceEventId,
    target: structuredClone(relationship.target),
    evidence: structuredClone(relationship.evidence),
  };
}

function mergeItem(seen, items, item) {
  const key = `${item.subject.type}:${item.subject.id}`;
  const existing = seen.get(key);
  if (!existing) {
    const copy = structuredClone(item);
    seen.set(key, copy);
    items.push(copy);
    return;
  }
  for (const reason of item.reasons) {
    const encoded = JSON.stringify(reason);
    if (!existing.reasons.some((value) => JSON.stringify(value) === encoded)) {
      existing.reasons.push(structuredClone(reason));
    }
  }
}
