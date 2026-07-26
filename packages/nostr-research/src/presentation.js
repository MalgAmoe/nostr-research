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

  if (value?.type === 'research-plan-report') shown = showPlanReport(memory, value, settings);
  else if (isAcquisition(value)) shown = showAcquisition(memory, value, settings);
  else if (value?.type === 'result-collection') shown = showCollection(memory, value, settings);
  else if (value?.collection?.type === 'result-collection') {
    shown = showCollection(memory, value.collection, settings);
  }
  else if (value?.type === 'typed-collection') shown = showTypedCollection(memory, value, settings);
  else if (value?.type === 'facets') shown = showFacets(value, settings);
  else if (value?.type === 'result-comparison') shown = showComparison(memory, value, settings);
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

export function explainResearchMembership(memory, collectionValue, subjectValue, options = {}) {
  const settings = inspectionOptions(options);
  const collection = memory.asCollection(collectionValue);
  const inspected = memory.inspect(subjectValue);
  const item = collection.items.find(({ subject }) => (
    subject.type === inspected.subject.type && subject.id === inspected.subject.id
  ));
  const reasons = item?.reasons ?? [];
  const shownReasons = reasons.slice(0, settings.previewLimit);
  const provenance = item?.provenance ?? inspected.provenance ?? [];
  const shownProvenance = settings.mode === 'summary'
    ? [] : provenance.slice(0, settings.previewLimit);
  return enforceSize({
    type: 'membership-explanation',
    subject: inspected.subject,
    member: Boolean(item),
    resultCount: collection.items.length,
    reasons: settings.mode === 'summary' ? [] : structuredClone(shownReasons),
    omittedReasons: reasons.length - shownReasons.length,
    provenance: structuredClone(shownProvenance),
    omittedProvenance: provenance.length - shownProvenance.length,
    context: {
      operation: collection.context?.operation,
      statement: item
        ? 'Reasons describe derived result membership; provenance describes observed evidence sources.'
        : 'The subject is not a member of this result.',
    },
  }, settings.sizeLimit);
}

export function presentHandleList(handles, options = {}) {
  const settings = listOptions(options);
  const all = [...handles].sort((left, right) => left.id.localeCompare(right.id));
  return {
    type: 'result-handle-list',
    count: all.length,
    preview: all.slice(0, settings.limit).map((item) => structuredClone(item)),
    omitted: Math.max(0, all.length - settings.limit),
  };
}

export function presentSessionStatus(memory, status, options = {}) {
  const settings = listOptions(options);
  const corpus = memory.describe();
  return enforceSize({
    type: 'declarative-session-status',
    revision: status.revision,
    corpus: {
      capacity: corpus.capacity,
      eventCount: corpus.eventCount,
      remainingCapacity: corpus.remainingCapacity,
      pressure: corpus.capacity === 0 ? 0 : corpus.eventCount / corpus.capacity,
      evictions: corpus.evictions,
    },
    retainedSetCount: memory.listSets().length,
    activeOperationCount: status.activeOperationCount,
    handleCount: status.handleCount,
  }, settings.sizeLimit);
}

export function acquisitionCorpusAccounting(additions = {}) {
  const addedSubjects = new Set(additions.added ?? []);
  const refreshedSubjects = new Set(
    (additions.refreshed ?? []).filter((id) => !addedSubjects.has(id)),
  );
  return {
    added: addedSubjects.size,
    refreshed: refreshedSubjects.size,
    evicted: additions.evicted?.length ?? 0,
  };
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

  const items = [...records].map(([id]) => ({ subject: { type: 'event', id } }));
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
    freshness: evidenceFreshness(memory, items),
    corpus: corpusEffects(memory, items),
  };
}

function showCollection(memory, collection, settings) {
  const previewLimit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const preview = { ...collection, items: collection.items.slice(0, previewLimit) };
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
    orientation: collectionOrientation(memory, collection, settings),
  };
}

function showTypedCollection(memory, collection, settings) {
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const resolved = memory.asCollection(collection);
  const bounds = collection.bounds ?? resolved.bounds;
  const preview = resolved.items.slice(0, limit).map((item) => (
    resolved.kind === 'groups'
      ? showGroup(memory, item, resolved.itemKind, settings)
      : showSummary(item, settings)
  ));
  const omitted = Math.max(0, resolved.items.length - preview.length);
  return {
    type: 'typed-collection',
    kind: resolved.kind,
    itemKind: resolved.itemKind,
    count: resolved.items.length,
    preview,
    omitted,
    ordering: 'source collection order',
    truncation: {
      truncated: omitted > 0 || Boolean(bounds?.truncated),
      omittedItems: omitted,
      sourceOmittedItems: bounds?.omittedCount ?? 0,
      ...(bounds ? { operationBounds: structuredClone(bounds) } : {}),
    },
    context: compactContext(resolved.context, resolved.items.length),
    provenance: provenanceSummary(resolved.items.slice(0, limit)),
    corpus: {
      ...corpusState(memory),
      subjectEffects: {
        available: false,
        statement: 'This derived summary does not retain a parallel subject collection; inspect or show its source result for subject residency and retention effects.',
      },
    },
  };
}

function showFacets(value, settings) {
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const shown = {
    type: 'facets',
    count: value.count,
    context: structuredClone(value.context),
    freshness: structuredClone(value.freshness),
    corpus: structuredClone(value.corpus),
  };
  for (const name of [
    'authors',
    'tags',
    'kinds',
    'observedRelays',
    'linkedSourceDomains',
    'presence',
  ]) {
    const category = value[name] ?? { values: [], omitted: 0 };
    const values = category.values ?? [];
    const preview = values.slice(0, limit);
    shown[name] = {
      count: values.length + (category.omitted ?? 0),
      values: structuredClone(preview),
      omitted: (category.omitted ?? 0) + values.length - preview.length,
      tail: structuredClone((category.tail ?? []).slice(0, limit)),
      omittedTail: Math.max(0, (category.tail?.length ?? 0) - limit),
      ordering: category.ordering ?? 'count-descending, then identifier',
    };
  }
  return shown;
}

function showComparison(memory, value, settings) {
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const sections = {};
  for (const name of ['shared', 'onlyLeft', 'onlyRight']) {
    const collection = {
      type: 'result-collection',
      kind: value.kind,
      items: value[name] ?? [],
      context: { operation: `comparison-${name}` },
    };
    const shown = showCollection(memory, collection, { ...settings, previewLimit: limit });
    sections[name] = {
      count: collection.items.length,
      preview: shown.preview,
      omitted: shown.omitted,
      freshness: shown.orientation.freshness,
    };
  }
  return {
    type: 'result-comparison',
    kind: value.kind,
    count: value.leftCount + value.rightCount,
    population: {
      left: value.leftCount,
      right: value.rightCount,
      shared: sections.shared.count,
      onlyLeft: sections.onlyLeft.count,
      onlyRight: sections.onlyRight.count,
    },
    method: 'Stable subject identity membership; section previews preserve source result order.',
    sections,
    truncation: {
      truncated: Object.values(sections).some(({ omitted }) => omitted > 0),
      omitted: Object.fromEntries(
        Object.entries(sections).map(([name, section]) => [name, section.omitted]),
      ),
    },
    corpus: corpusEffects(memory, [...value.shared, ...value.onlyLeft, ...value.onlyRight]),
  };
}

function showGroup(memory, group, itemKind, settings) {
  const collection = {
    type: 'result-collection',
    kind: itemKind,
    items: group.items,
    context: { operation: 'group-preview' },
  };
  const shown = showCollection(memory, collection, settings);
  return {
    key: structuredClone(group.key),
    count: group.memberCount ?? group.items.length,
    preview: shown.preview,
    omitted: Math.max(0, (group.memberCount ?? group.items.length) - shown.preview.length),
    retainedCount: group.retainedMemberCount ?? group.items.length,
    sourceOmitted: group.omittedMemberCount ?? 0,
    reasonCount: group.reasons?.length ?? 0,
    provenance: provenanceSummary([group]),
  };
}

function showSummary(summary, settings) {
  const reasons = summary.reasons ?? [];
  const provenance = summary.provenance ?? [];
  return {
    key: structuredClone(summary.key),
    values: structuredClone(summary.values),
    ...(summary.omissions ? { omissions: structuredClone(summary.omissions) } : {}),
    reasonCount: reasons.length,
    provenance: provenanceSummary([summary]),
    ...(settings.includeEvidence ? {
      reasons: structuredClone(reasons.slice(0, settings.previewLimit)),
      omittedReasons: Math.max(0, reasons.length - settings.previewLimit),
      evidenceProvenance: structuredClone(provenance.slice(0, settings.previewLimit)),
      omittedProvenance: Math.max(0, provenance.length - settings.previewLimit),
    } : {}),
  };
}

function showSubject(memory, item, settings) {
  const projected = memory.project(item, {
    mode: 'compact', excerptLimit: settings.excerptLimit, previewLimit: settings.previewLimit,
  }).results[0];
  const inspected = memory.inspect(item);
  const record = inspected.evidence;
  const provenance = inspected.provenance ?? [];
  return {
    type: item.type,
    id: item.id,
    preview: projected,
    resident: inspected.resident,
    context: { resolved: inspected.resident },
    provenance: provenanceSummary([{ provenance }]),
    freshness: evidenceFreshness(memory, [{ subject: item }]),
    corpus: corpusEffects(memory, [{ subject: item }]),
    omittedProvenance: settings.includeEvidence
      ? Math.max(0, provenance.length - settings.previewLimit) : provenance.length,
    ...(settings.includeEvidence && record ? { evidence: evidenceDetail({ record }, settings.excerptLimit).evidence } : {}),
  };
}

function showSet(memory, value, settings) {
  const id = value.id;
  const members = value.members ?? memory.getSet(id).members;
  const projected = memory.project({ type: 'set', id }, {
    mode: 'compact', excerptLimit: settings.excerptLimit, previewLimit: settings.previewLimit,
  }).results[0];
  return {
    type: 'set', id, count: value.memberCount ?? value.members?.length ?? projected.memberCount,
    preview: settings.mode === 'summary' ? [] : projected.preview,
    omitted: Math.max(0, (value.memberCount ?? value.members?.length ?? 0)
      - (settings.mode === 'summary' ? 0 : projected.preview?.length ?? 0)),
    context: { name: value.name, createdAt: value.createdAt },
    freshness: evidenceFreshness(memory, members.map((member) => ({ subject: member }))),
    corpus: corpusEffects(memory, members.map((member) => ({ subject: member }))),
    provenance: settings.includeEvidence && value.members
      ? value.members.slice(0, settings.previewLimit).map((member) => ({
          subject: { type: member.type, id: member.id }, reasons: member.reasons,
        })) : [],
    omittedProvenance: settings.includeEvidence && value.members
      ? Math.max(0, value.members.length - settings.previewLimit)
      : value.members?.length ?? value.memberCount ?? 0,
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

function showAcquisition(memory, value, settings) {
  const distinctEvents = new Set((value.acquiredObservations ?? []).map((item) => item.eventId)).size;
  const corpusChanges = acquisitionCorpusAccounting(value.additions);
  if (settings.mode === 'coverage') {
    const relays = value.coverage?.relays ?? [];
    const observedEvents = value.coverage?.observedEvents ?? [];
    return {
      type: 'acquisition-coverage',
      count: distinctEvents,
      requested: structuredClone(value.coverage?.requested ?? value.requested),
      budget: structuredClone(value.coverage?.budget ?? value.budget),
      completionReason: value.completionReason,
      exhaustive: false,
      uncertainty: value.coverage?.uncertainty,
      relays: structuredClone(relays.slice(0, settings.previewLimit)),
      omittedRelays: Math.max(0, relays.length - settings.previewLimit),
      observedEvents: structuredClone(observedEvents.slice(0, settings.previewLimit)),
      omittedObservedEvents: Math.max(0, observedEvents.length - settings.previewLimit),
    };
  }
  const collection = value.collection ?? memory.asCollection(value);
  return {
    type: 'acquisition',
    count: distinctEvents,
    scope: { type: 'acquisition', subjects: collection.items.length },
    preview: settings.mode === 'summary'
      ? [] : showCollection(memory, collection, settings).preview,
    omitted: settings.mode === 'summary'
      ? collection.items.length : Math.max(0, collection.items.length - settings.previewLimit),
    context: {
      requested: value.requested, budget: value.budget,
      completionReason: value.completionReason,
      startedAt: value.startedAt, finishedAt: value.finishedAt,
      counts: { ...value.counts, distinctEventsAcquired: distinctEvents },
      corpus: {
        before: corpusCapacity(value.corpusBefore),
        after: corpusCapacity(value.corpusAfter),
        ...corpusChanges,
      },
      exhaustive: false,
      uncertainty: value.coverage?.uncertainty
        ?? 'A bounded attempt was made; exhaustive relay indexing is not implied.',
    },
    facets: facetResearchCollection(memory, collection, {
      limit: Math.min(settings.previewLimit, DEFAULT_FACET_LIMIT),
    }),
    provenance: [],
  };
}

function showPlanReport(memory, value, settings) {
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const stages = value.stages ?? [];
  return {
    type: 'research-plan-report',
    count: stages.length,
    preview: stages.slice(0, limit).map((stage) => ({
      id: stage.id,
      operation: stage.operation,
      resultKind: stage.resultKind,
      result: showResearchValue(memory, null, stage.result, {
        mode: 'summary',
        previewLimit: settings.previewLimit,
        excerptLimit: settings.excerptLimit,
        sizeLimit: Math.max(1000, Math.floor(settings.sizeLimit / Math.max(1, limit))),
      }),
    })),
    omitted: stages.length - Math.min(stages.length, limit),
    context: { stageCount: stages.length },
    provenance: [],
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
          omittedTags: Math.max(0, record.metadataEvent.tags.length - 20),
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
        omittedTags: Math.max(0, record.event.tags.length - 20),
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

function collectionOrientation(memory, collection, settings) {
  const typeCounts = {};
  for (const { subject: item } of collection.items) {
    typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1;
  }
  const corpus = corpusEffects(memory, collection.items);
  const membership = membershipEvidence(collection.items, settings.previewLimit);
  const facets = facetResearchCollection(memory, collection, {
    limit: Math.min(settings.previewLimit, DEFAULT_FACET_LIMIT),
  });
  const contextRelationships = collection.context?.relationships ?? [];
  const relationships = contextRelationships.length
    ? contextRelationships
    : collection.items.flatMap(({ reasons = [] }) => reasons
      .filter(({ type }) => type === 'relationship')
      .map((reason) => ({
        ...reason,
        type: reason.relationshipType ?? 'unknown',
      })));
  const relationshipTypes = new Map();
  let unresolvedRelationships = 0;
  for (const relationship of relationships) {
    increment(relationshipTypes, relationship.type ?? 'unknown');
    if (relationship.resolved === false || relationship.known === false) {
      unresolvedRelationships += 1;
    }
  }
  return {
    population: {
      subjects: collection.items.length,
      byType: typeCounts,
      residentEvidence: corpus.resident,
      subjectsWithMembershipEvidence: membership.subjectsWithEvidence,
    },
    sampling: {
      method: collection.context?.query?.order
        ? `collection order (${collection.context.query.order})`
        : 'source collection order',
      limit: settings.mode === 'summary' ? 0 : settings.previewLimit,
    },
    truncation: {
      truncated: collection.items.length > (settings.mode === 'summary' ? 0 : settings.previewLimit),
      omittedSubjects: Math.max(
        0, collection.items.length - (settings.mode === 'summary' ? 0 : settings.previewLimit),
      ),
    },
    freshness: evidenceFreshness(memory, collection.items),
    corpus,
    membershipEvidence: membership,
    facets,
    conversation: {
      relationshipCount: relationships.length,
      types: facetCategory(relationshipTypes, settings.previewLimit, (id, count) => ({ id, count })),
      unresolvedRelationships,
    },
  };
}

function membershipEvidence(items, limit) {
  const reasonTypes = new Map();
  let reasonCount = 0;
  let provenanceCount = 0;
  let subjectsWithEvidence = 0;
  for (const item of items) {
    const reasons = item.reasons ?? [];
    const provenance = item.provenance ?? [];
    reasonCount += reasons.length;
    provenanceCount += provenance.length;
    if (reasons.length || provenance.length) subjectsWithEvidence += 1;
    for (const reason of reasons) increment(reasonTypes, reason.type ?? 'unknown');
  }
  const types = facetCategory(reasonTypes, limit, (id, count) => ({ id, count }));
  return {
    basis: 'collection membership reasons and provenance',
    subjectsWithEvidence,
    reasonCount,
    provenanceCount,
    reasonTypes: types,
    truncation: {
      truncated: types.omitted > 0,
      omittedReasonTypes: types.omitted,
    },
  };
}

function evidenceFreshness(memory, items) {
  const observations = [];
  let resident = 0;
  for (const item of items) {
    const inspected = memory.inspect(item.subject);
    if (inspected.resident) resident += 1;
    const provenance = uniqueObjects([
      ...(item.provenance ?? []),
      ...(inspected.provenance ?? []),
    ]);
    for (const observation of provenance) {
      if (typeof observation.observedAt === 'string') observations.push(observation.observedAt);
    }
  }
  observations.sort();
  return {
    basis: 'collection provenance plus current canonical evidence observations',
    residentSubjects: resident,
    nonresidentSubjects: items.length - resident,
    observationCount: observations.length,
    oldestObservedAt: observations[0] ?? null,
    newestObservedAt: observations.at(-1) ?? null,
  };
}

function uniqueObjects(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function corpusEffects(memory, items) {
  const keys = new Set(items.map(({ subject: item }) => `${item.type}:${item.id}`));
  let resident = 0;
  for (const { subject: item } of items) {
    if (memory.inspect(item).resident) resident += 1;
  }
  let retained = 0;
  for (const summary of memory.listSets()) {
    const set = memory.getSet(summary.id);
    retained += set.members.filter((member) => keys.has(`${member.type}:${member.id}`)).length;
  }
  return {
    ...corpusState(memory),
    resident,
    nonresident: items.length - resident,
    retainedMemberships: retained,
    statement: 'Retained membership preserves subject identity and reasons, not evicted canonical evidence.',
  };
}

function corpusState(memory) {
  const corpus = memory.describe();
  return {
    capacity: corpus.capacity,
    residentEvents: corpus.eventCount,
    remainingCapacity: corpus.remainingCapacity,
    pressure: corpus.capacity === 0 ? 0 : corpus.eventCount / corpus.capacity,
    evictions: corpus.evictions,
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
  const shown = all.slice(0, limit);
  const shownIds = new Set(shown.map(([id]) => id));
  const tail = all.slice().reverse()
    .filter(([id]) => !shownIds.has(id))
    .slice(0, Math.min(3, limit));
  return {
    values: shown.map(([id, count]) => present(id, count)),
    omitted: Math.max(0, all.length - limit),
    tail: tail.map(([id, count]) => present(id, count)),
    ordering: 'count-descending, then identifier; tail is lowest-count then reverse identifier',
  };
}

function urlsIn(text) {
  return [...String(text).matchAll(/https?:\/\/[^\s<>"')\]]+/giu)].flatMap(([raw]) => {
    try { return [new URL(raw)]; } catch { return []; }
  });
}

function inspectionOptions(options) {
  assertOptions(options, ['mode', 'previewLimit', 'excerptLimit', 'includeEvidence', 'sizeLimit']);
  if (options.mode !== undefined && !['summary', 'preview', 'coverage'].includes(options.mode)) {
    throw new TypeError('mode must be summary, preview, or coverage.');
  }
  return {
    mode: options.mode ?? 'preview',
    previewLimit: boundedInteger(options.previewLimit, DEFAULT_PREVIEW_LIMIT, MAX_PREVIEW_LIMIT, 'previewLimit'),
    excerptLimit: boundedInteger(options.excerptLimit, DEFAULT_EXCERPT_LIMIT, MAX_EXCERPT_LIMIT, 'excerptLimit'),
    sizeLimit: boundedInteger(options.sizeLimit, DEFAULT_SIZE_LIMIT, MAX_SIZE_LIMIT, 'sizeLimit', 1000),
    includeEvidence: options.includeEvidence === true,
  };
}

function listOptions(options) {
  assertOptions(options, ['limit', 'sizeLimit']);
  return {
    limit: boundedInteger(options.limit, DEFAULT_PREVIEW_LIMIT, MAX_PREVIEW_LIMIT, 'limit'),
    sizeLimit: boundedInteger(options.sizeLimit, DEFAULT_SIZE_LIMIT, MAX_SIZE_LIMIT, 'sizeLimit', 1000),
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
    omitted: copy.truncation
      ? sum(Object.values(copy.truncation.omitted ?? {}).map((count) => ({ count })), 'count')
      : (copy.omitted ?? 0) + (Array.isArray(copy.preview) ? copy.preview.length : 0),
    context: { bounded: true, note: `Inspection exceeded the ${maximum}-byte approximate bound.` },
    ...(copy.orientation ? {
      orientation: {
        population: copy.orientation.population,
        sampling: copy.orientation.sampling,
        truncation: {
          truncated: true,
          omittedSubjects: copy.orientation.population?.subjects ?? 0,
          sizeBounded: true,
        },
        freshness: copy.orientation.freshness,
        corpus: copy.orientation.corpus,
      },
    } : {}),
    ...(copy.freshness ? { freshness: copy.freshness } : {}),
    ...(copy.corpus ? { corpus: copy.corpus } : {}),
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
