const DEFAULT_PREVIEW_LIMIT = 5;
const MAX_PREVIEW_LIMIT = 20;
const DEFAULT_EXCERPT_LIMIT = 160;
const MAX_EXCERPT_LIMIT = 1000;
const DEFAULT_SIZE_LIMIT = 12_000;
const MAX_SIZE_LIMIT = 50_000;
const DEFAULT_FACET_LIMIT = 10;
const MAX_FACET_LIMIT = 50;

export function showResearchValue(memory, session, value, options = {}) {
  const settings = inspectionOptions(options);
  let shown;

  if (isAcquisition(value)) shown = showAcquisition(value, settings);
  else if (value?.type === 'result-collection') shown = showCollection(memory, value, settings);
  else if (isSessionDescription(value)) shown = showSession(memory, value, settings);
  else if (isCorpusSummary(value)) shown = showCorpus(value);
  else if (isResearchSet(value)) shown = showSet(memory, value, settings);
  else if (isSubject(value?.subject)) shown = showSubject(memory, value.subject, settings);
  else if (isEventRecord(value)) shown = showSubject(memory, {
    type: 'event', id: value.event.id,
  }, settings, value);
  else if (isAccountRecord(value)) shown = showSubject(memory, {
    type: 'account', id: value.metadataEvent.pubkey,
  }, settings, value);
  else if (isAccountResult(value)) shown = showSubject(memory, {
    type: 'account', id: value.publicKey,
  }, settings, value);
  else if (isSubject(value)) shown = showSubject(memory, value, settings);
  else if (value === memory) shown = showCorpus(memory.describe());
  else if (value === session) shown = showSession(memory, session.describe(), settings);
  else throw new TypeError('research.show does not recognize this value.');

  return enforceSize(shown, settings.sizeLimit);
}

export function facetResearchCollection(memory, value, options = {}) {
  const settings = facetOptions(options);
  const collection = memory.asCollection(value);
  const records = new Map();
  for (const item of collection.items) {
    if (item.subject.type !== 'event' || records.has(item.subject.id)) continue;
    const record = memory.getEvent(item.subject.id);
    if (record) records.set(item.subject.id, record);
  }

  const authors = new Map();
  const tags = new Map();
  const kinds = new Map();
  const relays = new Map();
  const domains = new Map();
  const presence = new Map([['links', 0], ['images', 0], ['videos', 0]]);
  for (const { event, observations } of records.values()) {
    increment(authors, event.pubkey);
    increment(kinds, String(event.kind));
    for (const encoded of new Set(event.tags
      .filter((tag) => tag.length >= 2 && typeof tag[0] === 'string' && typeof tag[1] === 'string')
      .map((tag) => JSON.stringify([tag[0], tag[1]])))) increment(tags, encoded);
    for (const relay of new Set(observations.map((item) => item.relay))) increment(relays, relay);

    const urls = urlsIn(event.content);
    for (const domain of new Set(urls.map((url) => url.hostname.toLocaleLowerCase()))) {
      increment(domains, domain);
    }
    if (urls.length) presence.set('links', presence.get('links') + 1);
    if (urls.some((url) => /\.(?:avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/iu.test(url.href))) {
      presence.set('images', presence.get('images') + 1);
    }
    if (urls.some((url) => /\.(?:m4v|mkv|mov|mp4|webm)(?:$|[?#])/iu.test(url.href))) {
      presence.set('videos', presence.get('videos') + 1);
    }
  }

  return {
    type: 'facets',
    count: records.size,
    context: {
      operation: 'facets',
      sourceOperation: collection.context.operation,
      statement: 'Counts describe distinct events in the supplied collection; they are not global trends or scores.',
    },
    authors: facetCategory(authors, settings.limit, (id, count) => ({
      id, subject: { type: 'account', id }, count,
    })),
    tags: facetCategory(tags, settings.limit, (id, count) => {
      const [name, value] = JSON.parse(id);
      return { id, name, value, query: { tags: { [name]: [value] } }, count };
    }),
    kinds: facetCategory(kinds, settings.limit, (id, count) => ({
      id: Number(id), query: { kinds: [Number(id)] }, count,
    })),
    observedRelays: facetCategory(relays, settings.limit, (id, count) => ({
      id, relay: id, count,
    })),
    linkedSourceDomains: facetCategory(domains, settings.limit, (id, count) => ({
      id, domain: id, count,
    })),
    presence: facetCategory(presence, settings.limit, (id, count) => ({ id, count })),
  };
}

function showCollection(memory, collection, settings) {
  const preview = { ...collection, items: collection.items.slice(0, settings.previewLimit) };
  const resolved = memory.asCollection(preview);
  const projected = memory.project(resolved, {
    mode: 'compact',
    excerptLimit: settings.excerptLimit,
    previewLimit: settings.previewLimit,
  });
  return {
    type: 'result-collection',
    count: collection.items.length,
    preview: projected.results.map((item, index) => ({
      ...compactResult(item),
      ...(settings.includeEvidence
        ? evidenceDetail(resolved.items[index], settings.excerptLimit) : {}),
    })),
    omitted: Math.max(0, collection.items.length - preview.items.length),
    context: compactContext(collection.context, collection.items.length),
    provenance: provenanceSummary(resolved.items),
  };
}

function showSubject(memory, item, settings) {
  const projected = memory.project(item, {
    mode: 'compact', excerptLimit: settings.excerptLimit, previewLimit: settings.previewLimit,
  }).results[0];
  const inspected = memory.inspect(item);
  const record = inspected.evidence;
  return {
    type: item.type,
    id: item.id,
    preview: projected,
    resident: inspected.resident,
    context: { resolved: inspected.resident },
    provenance: provenanceSummary([{ provenance: inspected.provenance ?? [] }]),
    ...(settings.includeEvidence && record ? { evidence: evidenceDetail({ record }, settings.excerptLimit).evidence } : {}),
  };
}

function showSet(memory, value, settings) {
  const id = value.id;
  const projected = memory.project({ type: 'set', id }, {
    mode: 'compact', excerptLimit: settings.excerptLimit, previewLimit: settings.previewLimit,
  }).results[0];
  return {
    type: 'set', id, count: value.memberCount ?? value.members?.length ?? projected.memberCount,
    preview: projected.preview, context: { name: value.name, createdAt: value.createdAt },
    provenance: settings.includeEvidence && value.members
      ? value.members.slice(0, settings.previewLimit).map((member) => ({
          subject: { type: member.type, id: member.id }, reasons: member.reasons,
        })) : [],
  };
}

function showCorpus(value) {
  return {
    type: 'corpus-summary', count: value.eventCount,
    preview: {
      capacity: value.capacity, remainingCapacity: value.remainingCapacity,
      authors: value.authors, kinds: value.kinds, tags: value.tags,
    },
    context: {
      evictions: value.evictions,
      outboundRelationships: value.outboundRelationships,
      inboundRelationships: value.inboundRelationships,
    },
    provenance: [],
  };
}

function showSession(memory, value, settings) {
  return {
    type: 'session-description',
    count: value.selection.items.length,
    preview: showCollection(memory, value.selection, settings).preview,
    context: { action: value.action },
    provenance: [],
  };
}

function showAcquisition(value, settings) {
  const distinctEvents = new Set((value.acquiredObservations ?? []).map((item) => item.eventId)).size;
  return {
    type: 'acquisition',
    count: distinctEvents,
    preview: value.relays.slice(0, settings.previewLimit),
    omitted: Math.max(0, value.relays.length - settings.previewLimit),
    context: {
      requested: value.requested, budget: value.budget,
      completionReason: value.completionReason,
      startedAt: value.startedAt, finishedAt: value.finishedAt,
      counts: { ...value.counts, distinctEventsAcquired: distinctEvents },
      exhaustive: false,
      uncertainty: value.coverage?.uncertainty
        ?? 'A bounded attempt was made; exhaustive relay indexing is not implied.',
    },
    provenance: settings.includeEvidence
      ? value.acquiredObservations.slice(0, settings.previewLimit) : [],
  };
}

function evidenceDetail(item, excerptLimit) {
  const detail = {
    reasons: structuredClone(item.reasons ?? []),
    provenance: structuredClone(item.provenance ?? []),
  };
  const record = item.record;
  if (record?.metadataEvent) {
    return {
      evidence: {
        ...detail,
        profile: record.profile,
        metadataEvent: {
          ...record.metadataEvent,
          content: excerpt(record.metadataEvent.content, excerptLimit),
          tags: record.metadataEvent.tags.slice(0, 20),
        },
        observationCount: record.observations?.length ?? 0,
      },
    };
  }
  if (!record?.event) return { evidence: detail };
  return {
    evidence: {
      ...detail,
      event: {
        ...record.event,
        content: excerpt(record.event.content, excerptLimit),
        tags: record.event.tags.slice(0, 20),
      },
      observationCount: record.observations?.length ?? 0,
    },
  };
}

function compactResult(item) {
  const { reasons = [], provenance: _provenance, ...result } = item;
  const relationships = reasons.filter(({ type }) => type === 'relationship');
  const relationshipTypes = [...new Set(
    relationships.map(({ relationshipType }) => relationshipType).filter(Boolean),
  )].sort();
  return {
    ...result,
    reasonSummary: {
      count: reasons.length,
      relationshipCount: relationships.length,
      relationshipTypes,
    },
  };
}

function provenanceSummary(items) {
  const relays = new Set();
  let observations = 0;
  for (const item of items) {
    for (const source of item.provenance ?? item.record?.observations ?? []) {
      observations += 1;
      if (source.relay) relays.add(source.relay);
    }
  }
  return { observations, relays: [...relays].sort() };
}

function compactContext(context, resultingSubjectCount) {
  if (!context || typeof context !== 'object') return context;
  const { relationships, expansion, ...rest } = context;
  return {
    ...rest,
    ...(Array.isArray(relationships) ? { relationshipCount: relationships.length } : {}),
    ...(expansion ? {
      expansion: compactExpansion(expansion, resultingSubjectCount),
    } : {}),
  };
}

function compactExpansion(expansion, resultingSubjectCount) {
  const options = expansion.options ?? {};
  const boundedBy = expansion.boundedBy ?? {};
  const failures = expansionFailures(expansion.requests);
  const authoredRequests = (expansion.requests ?? []).filter(
    ({ purpose }) => purpose === 'authored-notes',
  );
  return {
    subjects: {
      starting: expansion.startingSubjects?.length ?? 0,
      resulting: resultingSubjectCount,
    },
    requests: expansion.requestCount ?? expansion.requests?.length ?? 0,
    ...(options.authoredLimit === undefined ? {} : {
      authoredNoteRequests: authoredRequests.length,
    }),
    filters: expansion.filterCount ?? 0,
    counts: {
      acceptedObservations: expansion.counts?.acceptedObservations ?? 0,
      distinctEventsAcquired: expansion.counts?.distinctEventsAcquired ?? 0,
      newlyStoredCorpusEvents: expansion.counts?.newlyStoredCorpusEvents ?? 0,
      duplicateObservations: expansion.counts?.duplicateObservations ?? 0,
      receivedPackets: expansion.counts?.receivedPackets ?? 0,
      invalid: expansion.counts?.invalid ?? 0,
    },
    corpus: {
      before: corpusCapacity(expansion.corpusBefore),
      after: corpusCapacity(expansion.corpusAfter),
    },
    unresolved: {
      before: unresolvedCounts(expansion.unresolvedBefore),
      after: unresolvedCounts(expansion.unresolvedAfter),
    },
    completionReason: expansion.completionReason,
    bounds: {
      depth: { limit: options.depth, reached: boundedBy.depth === true },
      traversal: { limit: options.limit, reached: boundedBy.traversalLimit === true },
      observations: {
        limit: options.observationLimit,
        reached: boundedBy.observationBudget === true,
      },
      distinctEvents: {
        limit: options.distinctEventLimit,
        reached: boundedBy.distinctEventBudget === true,
      },
      ...(options.authoredLimit === undefined ? {} : {
        authoredNotesPerAccount: { limit: options.authoredLimit },
      }),
      timeoutMs: { limit: options.timeoutMs, reached: boundedBy.timeout === true },
      cancellation: { reached: boundedBy.cancellation === true },
    },
    failures,
  };
}

function corpusCapacity(value) {
  return { events: value?.eventCount ?? 0, capacity: value?.capacity ?? 0 };
}

function unresolvedCounts(value) {
  return {
    events: Array.isArray(value?.events) ? value.events.length : 0,
    accounts: Array.isArray(value?.accounts) ? value.accounts.length : 0,
  };
}

function expansionFailures(requests) {
  const failures = [];
  const seen = new Set();
  for (const request of requests ?? []) {
    for (const response of request.relays ?? []) {
      if (!response.diagnostic) continue;
      const diagnostic = excerpt(response.diagnostic, 160);
      const key = JSON.stringify([response.relay, diagnostic]);
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push({ relay: response.relay, diagnostic });
    }
  }
  const shown = failures.slice(0, 5);
  return {
    items: shown,
    omitted: failures.length - shown.length,
  };
}

function facetCategory(map, limit, present) {
  const all = [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  return {
    values: all.slice(0, limit).map(([id, count]) => present(id, count)),
    omitted: Math.max(0, all.length - limit),
  };
}

function urlsIn(text) {
  return [...String(text).matchAll(/https?:\/\/[^\s<>"')\]]+/giu)].flatMap(([raw]) => {
    try { return [new URL(raw)]; } catch { return []; }
  });
}

function inspectionOptions(options) {
  assertOptions(options, ['previewLimit', 'excerptLimit', 'includeEvidence', 'sizeLimit']);
  return {
    previewLimit: boundedInteger(options.previewLimit, DEFAULT_PREVIEW_LIMIT, MAX_PREVIEW_LIMIT, 'previewLimit'),
    excerptLimit: boundedInteger(options.excerptLimit, DEFAULT_EXCERPT_LIMIT, MAX_EXCERPT_LIMIT, 'excerptLimit'),
    sizeLimit: boundedInteger(options.sizeLimit, DEFAULT_SIZE_LIMIT, MAX_SIZE_LIMIT, 'sizeLimit', 1000),
    includeEvidence: options.includeEvidence === true,
  };
}

function facetOptions(options) {
  assertOptions(options, ['limit']);
  return { limit: boundedInteger(options.limit, DEFAULT_FACET_LIMIT, MAX_FACET_LIMIT, 'limit') };
}

function assertOptions(options, allowed) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Options must be an object.');
  }
  const unknown = Object.keys(options).find((key) => !allowed.includes(key));
  if (unknown) throw new TypeError(`Unknown option: ${unknown}.`);
  if (options.includeEvidence !== undefined && typeof options.includeEvidence !== 'boolean') {
    throw new TypeError('includeEvidence must be a boolean.');
  }
}

function boundedInteger(value, fallback, maximum, label, minimum = 1) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function enforceSize(value, maximum) {
  const copy = structuredClone(value);
  while (Buffer.byteLength(JSON.stringify(copy)) > maximum && Array.isArray(copy.preview)
      && copy.preview.length > (copy.context?.expansion ? 0 : 1)) {
    copy.preview.pop();
    copy.omitted = (copy.omitted ?? 0) + 1;
  }
  if (Buffer.byteLength(JSON.stringify(copy)) <= maximum) return copy;
  if (copy.context?.expansion) {
    compactExpansionPresentation(copy, maximum);
    if (Buffer.byteLength(JSON.stringify(copy)) <= maximum) return copy;
  }
  return {
    type: copy.type, ...(copy.id ? { id: copy.id } : {}),
    ...(copy.count !== undefined ? { count: copy.count } : {}),
    preview: [],
    omitted: (copy.omitted ?? 0) + (Array.isArray(copy.preview) ? copy.preview.length : 0),
    context: { bounded: true, note: `Inspection exceeded the ${maximum}-byte approximate bound.` },
    provenance: [],
  };
}

function compactExpansionPresentation(value, maximum) {
  value.provenance = [];
  const failures = value.context.expansion.failures;
  while (Buffer.byteLength(JSON.stringify(value)) > maximum && failures.items.length > 1) {
    failures.items.pop();
    failures.omitted += 1;
  }

  for (const limit of [120, 80, 48, 32, 20, 12]) {
    if (Buffer.byteLength(JSON.stringify(value)) <= maximum) return;
    failures.items = failures.items.map((failure) => ({
      relay: excerpt(failure.relay, limit),
      diagnostic: excerpt(failure.diagnostic, limit),
    }));
  }

  if (Buffer.byteLength(JSON.stringify(value)) > maximum) {
    value.context = { expansion: value.context.expansion };
  }
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sum(items, field) {
  return items.reduce((total, item) => total + (item[field] ?? 0), 0);
}

function excerpt(value, maximum) {
  const text = String(value).replace(/\s+/gu, ' ').trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function isSubject(value) {
  return value && ['event', 'account', 'set', 'tag'].includes(value.type)
    && typeof value.id === 'string';
}

function isAcquisition(value) {
  return value && value.requested && value.budget && Array.isArray(value.acquiredObservations)
    && value.counts && Array.isArray(value.relays);
}

function isEventRecord(value) {
  return value?.event && typeof value.event.id === 'string' && Array.isArray(value.observations);
}

function isAccountRecord(value) {
  return value?.metadataEvent && typeof value.metadataEvent.pubkey === 'string'
    && Array.isArray(value.observations);
}

function isAccountResult(value) {
  return value && typeof value.publicKey === 'string';
}

function isResearchSet(value) {
  return value && typeof value.id === 'string' && typeof value.name === 'string'
    && (Array.isArray(value.members) || Number.isInteger(value.memberCount));
}

function isCorpusSummary(value) {
  return value && Number.isInteger(value.capacity) && Number.isInteger(value.eventCount)
    && Number.isInteger(value.remainingCapacity);
}

function isSessionDescription(value) {
  return value && value.selection?.type === 'result-collection'
    && value.action && typeof value.action.type === 'string';
}
