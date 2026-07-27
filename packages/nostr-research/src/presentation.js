import { resolveRelationForPresentation } from './relation.js';
import { RESEARCH_CONSTRAINTS } from './configuration.js';

const DEFAULT_PREVIEW_LIMIT = RESEARCH_CONSTRAINTS.presentation.previewLimit.default;
const MAX_PREVIEW_LIMIT = RESEARCH_CONSTRAINTS.presentation.previewLimit.maximum;
const DEFAULT_EXCERPT_LIMIT = RESEARCH_CONSTRAINTS.presentation.excerptLimit.default;
const MAX_EXCERPT_LIMIT = RESEARCH_CONSTRAINTS.presentation.excerptLimit.maximum;
const DEFAULT_SIZE_LIMIT = RESEARCH_CONSTRAINTS.presentation.sizeLimit.default;
const MAX_SIZE_LIMIT = RESEARCH_CONSTRAINTS.presentation.sizeLimit.maximum;

export function showResearchValue(memory, value, options = {}) {
  const settings = inspectionOptions(options);
  let shown;

  if (value?.type === 'research-plan-report') shown = showPlanReport(memory, value, settings);
  else if (isAcquisition(value)) shown = showAcquisition(memory, value, settings);
  else if (value?.type === 'result-collection') shown = showCollection(memory, value, settings);
  else if (value?.collection?.type === 'result-collection') {
    shown = showCollection(memory, value.collection, settings);
  }
  else if (value?.type === 'typed-collection') shown = showTypedCollection(memory, value, settings);
  else if (value?.type === 'research-relation') shown = showRelation(memory, value, settings);
  else if (value?.type === 'notebook-membership') {
    shown = showCollection(memory, memory.asCollection(value), settings);
  }
  else if (isCorpusSummary(value)) shown = showCorpus(value);
  else if (isSubject(value?.subject)) shown = showSubject(memory, value.subject, settings);
  else if (isSubject(value)) shown = showSubject(memory, value, settings);
  else if (value === memory) shown = showCorpus(memory.describe());
  else throw new TypeError('show does not recognize this value.');

  return enforceSize(shown, settings.sizeLimit);
}

export function boundResearchPresentation(value, sizeLimit) {
  return enforceSize(value, boundedInteger(
    sizeLimit, DEFAULT_SIZE_LIMIT, MAX_SIZE_LIMIT, 'sizeLimit', 1000,
  ));
}

export function validateResearchPresentationOptions(options = {}) {
  inspectionOptions(options);
}

function showRelation(memory, value, settings) {
  const resolved = resolveRelationForPresentation(memory, value);
  const distinctSubjects = new Set(resolved.rows.flatMap(
    (row) => row.subjects.map((subject) => `${subject.type}:${subject.id}`),
  ));
  const eventSubjects = new Map(resolved.rows.flatMap((row) => row.subjects
    .filter(({ type }) => type === 'event')
    .map((subject) => [subject.id, subject])));
  const distinctAuthors = new Set([...eventSubjects.values()].flatMap((eventSubject) => {
    const event = memory.inspect(eventSubject).evidence?.event;
    return typeof event?.pubkey === 'string' ? [event.pubkey] : [];
  }));
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const effectiveOffset = Math.min(settings.offset, resolved.rows.length);
  const preview = resolved.rows.slice(effectiveOffset, effectiveOffset + limit).map((row) => ({
    values: compactRelationValue(row.values, settings.excerptLimit),
    subjectCount: row.subjects.length,
    reasonCount: row.reasons.length,
    provenanceCount: row.provenance.length,
    ...(['details', 'explain'].includes(settings.mode) || settings.includeEvidence ? {
      subjects: settings.mode === 'details' || settings.includeEvidence
        ? row.subjects.slice(0, settings.previewLimit).map((subject) => ({
          subject: structuredClone(subject),
          ...showSubject(memory, subject, { ...settings, includeEvidence: true }),
        }))
        : structuredClone(row.subjects.slice(0, settings.previewLimit)),
      omittedSubjects: Math.max(0, row.subjects.length - settings.previewLimit),
      provenance: structuredClone(row.provenance.slice(0, settings.previewLimit)),
      omittedProvenance: Math.max(0, row.provenance.length - settings.previewLimit),
      ...(settings.mode === 'explain' ? {
        reasons: structuredClone(row.reasons.slice(0, settings.previewLimit)),
        omittedReasons: Math.max(0, row.reasons.length - settings.previewLimit),
      } : {}),
    } : {}),
  }));
  const result = {
    type: 'research-relation',
    observation: settings.mode,
    count: resolved.rows.length,
    distinctSubjectCount: distinctSubjects.size,
    distinctAuthorCount: distinctAuthors.size,
    preview,
    offset: effectiveOffset,
    limit,
    nextOffset: effectiveOffset + preview.length,
    omittedBefore: effectiveOffset,
    omittedAfter: Math.max(0, resolved.rows.length - effectiveOffset - preview.length),
    omitted: Math.max(0, resolved.rows.length - preview.length),
    sizeBounded: false,
    context: compactContext(value.context),
  };
  if (settings.mode === 'coverage') {
    result.preview = [];
    result.coverage = {
      evidenceResolution: resolutionCounts(memory, resolved.rows.flatMap(({ subjects }) => (
        subjects.map((subject) => ({ subject }))
      ))),
      rowsWithProvenance: resolved.rows.filter(({ provenance }) => provenance.length > 0).length,
      presentationOmissions: { rowDetails: resolved.rows.length },
      partial: value.context?.completeness?.status === 'partial',
    };
  }
  return result;
}

function compactRelationValue(value, excerptLimit) {
  if (typeof value === 'string') return excerpt(value, excerptLimit);
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => compactRelationValue(item, excerptLimit));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => (
      [key, compactRelationValue(item, excerptLimit)]
    )));
  }
  return value;
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
  return enforceSize({
    type: 'result-handle-list',
    count: all.length,
    preview: all.slice(0, settings.limit).map((item) => structuredClone(item)),
    omitted: Math.max(0, all.length - settings.limit),
  }, settings.sizeLimit);
}

export function presentSessionStatus(memory, status, options = {}) {
  const settings = listOptions(options);
  const state = memory.describe();
  const buffer = state.observationBuffer;
  return enforceSize({
    type: 'declarative-session-status',
    revision: status.revision,
    observationBuffer: {
      ...buffer,
      pressure: buffer.capacity === 0 ? 0 : buffer.eventCount / buffer.capacity,
    },
    archive: structuredClone(state.archive),
    notebook: structuredClone(state.notebook),
    configuration: structuredClone(status.configuration),
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

function showCollection(memory, collection, settings) {
  const previewLimit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const effectiveOffset = Math.min(settings.offset, collection.items.length);
  const preview = {
    ...collection,
    items: collection.items.slice(effectiveOffset, effectiveOffset + previewLimit),
  };
  const resolved = memory.asCollection(preview);
  const projected = memory.project(resolved, {
    mode: 'compact',
    excerptLimit: settings.excerptLimit,
    previewLimit: settings.previewLimit,
  });
  const result = {
    type: 'result-collection',
    observation: settings.mode,
    count: collection.items.length,
    preview: projected.results.map((item, index) => ({
      ...compactResult(item),
      ...(settings.includeEvidence
        ? evidenceDetail(resolved.items[index], settings.excerptLimit) : {}),
    })),
    offset: effectiveOffset,
    limit: previewLimit,
    nextOffset: effectiveOffset + preview.items.length,
    omittedBefore: effectiveOffset,
    omittedAfter: Math.max(0, collection.items.length - effectiveOffset - preview.items.length),
    omitted: Math.max(0, collection.items.length - preview.items.length),
    sizeBounded: false,
    context: compactContext(collection.context, collection.items.length),
  };
  if (settings.mode === 'summary') {
    result.preview = [];
    result.summary = {
      subjects: collection.items.length,
      byType: countedSubjectTypes(collection.items),
      evidenceResolution: resolutionCounts(memory, collection.items),
    };
  } else if (settings.mode === 'coverage') {
    result.preview = [];
    const provenance = provenanceSummary(collection.items);
    result.coverage = {
      sources: provenance,
      evidenceResolution: resolutionCounts(memory, collection.items),
      presentationOmissions: { subjectDetails: collection.items.length },
      partial: collection.context?.completeness?.status === 'partial',
      bounds: compactBounds(collection),
      unresolvedEvidence: resolutionCounts(memory, collection.items).unresolved,
    };
  } else if (settings.mode === 'details') {
    result.preview = resolved.items.map((item) => ({
      subject: structuredClone(item.subject),
      ...showSubject(memory, item.subject, { ...settings, includeEvidence: true }),
    }));
  } else if (settings.mode === 'explain') {
    result.preview = resolved.items.map((item) => ({
      subject: structuredClone(item.subject),
      reasons: structuredClone((item.reasons ?? []).slice(0, settings.previewLimit)),
      omittedReasons: Math.max(0, (item.reasons?.length ?? 0) - settings.previewLimit),
      provenance: structuredClone((item.provenance ?? []).slice(0, settings.previewLimit)),
      omittedProvenance: Math.max(0, (item.provenance?.length ?? 0) - settings.previewLimit),
    }));
  }
  return result;
}

function countedSubjectTypes(items) {
  const counts = {};
  for (const { subject } of items) counts[subject.type] = (counts[subject.type] ?? 0) + 1;
  return counts;
}

function compactBounds(collection) {
  const cardinality = collection.context?.cardinality;
  return cardinality ? structuredClone(cardinality) : {
    outputCount: collection.items.length,
    omittedCount: 0,
    truncated: false,
  };
}

function showTypedCollection(memory, collection, settings) {
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const resolved = memory.asCollection(collection);
  const bounds = collection.bounds ?? resolved.bounds;
  const effectiveOffset = Math.min(settings.offset, resolved.items.length);
  const selected = resolved.items.slice(effectiveOffset, effectiveOffset + limit);
  const preview = selected.map((item) => showTypedItem(item, settings));
  const omitted = Math.max(0, resolved.items.length - preview.length);
  const subjects = [];
  const evidenceResolution = resolutionCounts(memory, subjects);
  const result = {
    type: 'typed-collection',
    observation: settings.mode,
    kind: resolved.kind,
    itemKind: resolved.itemKind,
    count: resolved.items.length,
    preview,
    offset: effectiveOffset,
    limit,
    nextOffset: effectiveOffset + preview.length,
    omittedBefore: effectiveOffset,
    omittedAfter: Math.max(0, resolved.items.length - effectiveOffset - preview.length),
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
        statement: 'This derived summary does not create parallel notebook membership; inspect or show its source result for current evidence resolution.',
      },
    },
  };
  if (settings.mode === 'summary') {
    result.preview = [];
    result.summary = {
      items: resolved.items.length,
      kind: resolved.kind,
      itemKind: resolved.itemKind,
      representedSubjects: subjects.length,
      bounds: bounds ? structuredClone(bounds) : undefined,
    };
  } else if (settings.mode === 'coverage') {
    result.preview = [];
    result.coverage = {
      sources: provenanceSummary(resolved.items),
      evidenceResolution,
      unresolvedEvidence: evidenceResolution.unresolved,
      bounds: bounds ? structuredClone(bounds) : {
        outputCount: resolved.items.length, omittedCount: 0, truncated: false,
      },
      presentationOmissions: { items: resolved.items.length },
      partial: Boolean(bounds?.truncated),
    };
  }
  return result;
}

function showTypedItem(item, settings) {
  const summary = showSummary(item, settings);
  if (settings.mode === 'details') {
    return {
      ...summary,
      subjects: [],
      evidence: {
        available: false,
        statement: 'This derived summary contains no stable subject references to resolve.',
      },
    };
  }
  if (settings.mode === 'explain') {
    return {
      ...summary,
      reasons: structuredClone((item.reasons ?? []).slice(0, settings.previewLimit)),
      omittedReasons: Math.max(0, (item.reasons?.length ?? 0) - settings.previewLimit),
      evidenceProvenance: structuredClone(
        (item.provenance ?? []).slice(0, settings.previewLimit),
      ),
      omittedProvenance: Math.max(
        0, (item.provenance?.length ?? 0) - settings.previewLimit,
      ),
    };
  }
  return summary;
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
    resolved: inspected.resolved,
    resolutionSource: inspected.resolutionSource,
    context: { resolved: inspected.resolved, resolutionSource: inspected.resolutionSource },
    provenance: provenanceSummary([{ provenance }]),
    freshness: evidenceFreshness(memory, [{ subject: item }]),
    corpus: corpusEffects(memory, [{ subject: item }]),
    omittedProvenance: settings.includeEvidence
      ? Math.max(0, provenance.length - settings.previewLimit) : provenance.length,
    ...(settings.includeEvidence && record ? { evidence: evidenceDetail({ record }, settings.excerptLimit).evidence } : {}),
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

function showAcquisition(memory, value, settings) {
  const distinctEvents = new Set((value.acquiredObservations ?? []).map((item) => item.eventId)).size;
  const corpusChanges = acquisitionCorpusAccounting(value.additions);
  if (settings.mode === 'coverage') {
    const relays = value.coverage?.relays ?? [];
    const observedEvents = value.coverage?.observedEvents ?? [];
    const relayOffset = Math.min(settings.offset, relays.length);
    const eventOffset = Math.min(settings.offset, observedEvents.length);
    return {
      type: 'acquisition-coverage',
      observation: 'coverage',
      count: distinctEvents,
      requested: structuredClone(value.coverage?.requested ?? value.requested),
      budget: structuredClone(value.coverage?.budget ?? value.budget),
      completionReason: value.completionReason,
      exhaustive: false,
      uncertainty: value.coverage?.uncertainty,
      offset: settings.offset,
      relays: structuredClone(relays.slice(relayOffset, relayOffset + settings.previewLimit)),
      omittedRelaysBefore: relayOffset,
      omittedRelaysAfter: Math.max(0, relays.length - relayOffset - settings.previewLimit),
      observedEvents: structuredClone(
        observedEvents.slice(eventOffset, eventOffset + settings.previewLimit),
      ),
      omittedObservedEventsBefore: eventOffset,
      omittedObservedEventsAfter: Math.max(
        0, observedEvents.length - eventOffset - settings.previewLimit,
      ),
    };
  }
  const collection = value.collection ?? memory.asCollection(value);
  const shownCollection = showCollection(memory, collection, settings);
  return {
    type: 'acquisition',
    observation: settings.mode,
    count: distinctEvents,
    scope: { type: 'acquisition', subjects: collection.items.length },
    preview: shownCollection.preview,
    offset: shownCollection.offset,
    limit: shownCollection.limit,
    nextOffset: shownCollection.nextOffset,
    omittedBefore: shownCollection.omittedBefore,
    omittedAfter: shownCollection.omittedAfter,
    omitted: shownCollection.omitted,
    sizeBounded: false,
    context: {
      requested: value.requested, budget: value.budget,
      completionReason: value.completionReason,
      startedAt: value.startedAt, finishedAt: value.finishedAt,
      counts: { ...value.counts, distinctEventsAcquired: distinctEvents },
      corpus: {
        before: corpusSnapshot(value.corpusBefore),
        after: corpusSnapshot(value.corpusAfter),
        ...corpusChanges,
      },
      exhaustive: false,
      uncertainty: value.coverage?.uncertainty
        ?? 'A bounded attempt was made; exhaustive relay indexing is not implied.',
    },
  };
}

function showPlanReport(memory, value, settings) {
  const limit = settings.mode === 'summary' ? 0 : settings.previewLimit;
  const stages = value.stages ?? [];
  const effectiveOffset = Math.min(settings.offset, stages.length);
  const preview = stages.slice(effectiveOffset, effectiveOffset + limit);
  return {
    type: 'research-plan-report',
    count: stages.length,
    preview: preview.map((stage) => ({
      id: stage.id,
      operation: stage.operation,
      resultKind: stage.resultKind,
      result: showResearchValue(memory, stage.result, {
        mode: 'summary',
        previewLimit: settings.previewLimit,
        excerptLimit: settings.excerptLimit,
        sizeLimit: Math.max(1000, Math.floor(settings.sizeLimit / Math.max(1, limit))),
      }),
    })),
    offset: effectiveOffset,
    limit,
    nextOffset: effectiveOffset + preview.length,
    omittedBefore: effectiveOffset,
    omittedAfter: Math.max(0, stages.length - effectiveOffset - preview.length),
    omitted: stages.length - preview.length,
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

function compactContext(context) {
  if (!context || typeof context !== 'object') return context;
  if (context.operation === 'transform') {
    const stages = context.stages ?? [];
    return {
      operation: 'transform',
      sourceOperation: sourceOperation(context.input),
      stageCount: stages.length,
      ...(stages.length ? { latestStage: compactStage(stages.at(-1)) } : {}),
      ...(context.cardinality ? { cardinality: structuredClone(context.cardinality) } : {}),
      ...(context.name ? { name: context.name } : {}),
    };
  }
  if (context.operation === 'continuation') {
    return {
      operation: 'continuation',
      relationship: context.relationship,
      source: context.source,
      startCount: context.starts?.length ?? 0,
      limit: context.limit,
      ...(context.completeness ? {
        completeness: {
          attemptStatus: context.completeness.status,
          dataScope: context.completeness.scope,
          exhaustive: context.completeness.exhaustive,
          omissionCount: context.completeness.omissions?.length ?? 0,
          boundsReached: structuredClone(context.completeness.boundsReached ?? []),
        },
      } : {}),
    };
  }
  const { relationships, starts, completeness, input, stages, ...rest } = context;
  return {
    ...rest,
    ...(Array.isArray(relationships) ? { relationshipCount: relationships.length } : {}),
    ...(Array.isArray(starts) ? { startCount: starts.length } : {}),
  };
}

function sourceOperation(context) {
  let current = context;
  while (current?.operation === 'transform' && current.input) current = current.input;
  return current?.operation;
}

function compactStage(stage) {
  if (!stage || typeof stage !== 'object') return stage;
  if (stage.operation === 'filter') {
    return { operation: 'filter', where: structuredClone(stage.where), limit: stage.limit };
  }
  if (stage.operation === 'pick') {
    return { operation: 'pick', positions: structuredClone(stage.positions) };
  }
  if (['union', 'intersection', 'difference', 'compare'].includes(stage.operation)) {
    return {
      operation: stage.operation,
      with: structuredClone(stage.with),
      limit: stage.limit,
    };
  }
  const {
    operation, as, by, direction, limit, itemLimit, fields, to, aggregations,
  } = stage;
  return Object.fromEntries(Object.entries({
    operation, as, by, direction, limit, itemLimit, fields, to, aggregations,
  }).filter(([, value]) => value !== undefined));
}

function evidenceFreshness(memory, items) {
  const observations = [];
  const evidenceResolution = resolutionCounts(memory, items);
  for (const item of items) {
    const inspected = memory.inspect(item.subject);
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
    evidenceResolution,
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
  let retained = 0;
  for (const summary of memory.listMemberships()) {
    const set = memory.getMembership(summary.name);
    retained += set.members.filter((member) => keys.has(`${member.type}:${member.id}`)).length;
  }
  return {
    ...corpusState(memory),
    evidenceResolution: resolutionCounts(memory, items),
    namedMemberships: retained,
    statement: 'Notebook membership preserves subject identity and reasons, not evicted canonical evidence.',
  };
}

function resolutionCounts(memory, items) {
  const counts = { buffer: 0, archive: 0, unresolved: 0 };
  for (const { subject: item } of items) {
    const source = memory.inspect(item).resolutionSource;
    counts[source] = (counts[source] ?? 0) + 1;
  }
  return counts;
}

function corpusState(memory) {
  const corpus = memory.describe().observationBuffer;
  return {
    capacity: corpus.capacity,
    residentEvents: corpus.eventCount,
    remainingCapacity: corpus.remainingCapacity,
    pressure: corpus.capacity === 0 ? 0 : corpus.eventCount / corpus.capacity,
    evictions: corpus.evictions,
  };
}

function corpusSnapshot(corpus) {
  if (!corpus) return null;
  const buffer = corpus.observationBuffer ?? corpus;
  return {
    capacity: buffer.capacity,
    residentEvents: buffer.eventCount,
    remainingCapacity: buffer.remainingCapacity,
    pressure: buffer.capacity === 0 ? 0 : buffer.eventCount / buffer.capacity,
    evictions: buffer.evictions,
  };
}

function inspectionOptions(options) {
  assertOptions(options, [
    'mode', 'offset', 'previewLimit', 'excerptLimit', 'includeEvidence', 'sizeLimit',
  ]);
  if (options.mode !== undefined
      && !['preview', 'summary', 'coverage', 'details', 'explain'].includes(options.mode)) {
    throw new TypeError('mode must be preview, summary, coverage, details, or explain.');
  }
  return {
    mode: options.mode ?? 'preview',
    offset: boundedInteger(options.offset, 0, Number.MAX_SAFE_INTEGER, 'offset', 0),
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
  if (Buffer.byteLength(JSON.stringify(copy)) > maximum && Array.isArray(copy.provenance)) {
    copy.provenance = [];
    copy.provenanceOmittedForSize = true;
  }
  while (Buffer.byteLength(JSON.stringify(copy)) > maximum && Array.isArray(copy.preview)
      && copy.preview.length > 1) {
    copy.preview.pop();
    copy.omitted = (copy.omitted ?? 0) + 1;
    if (Number.isSafeInteger(copy.omittedAfter)) copy.omittedAfter += 1;
    if ('sizeBounded' in copy) markSizeBound(copy);
    if (Number.isSafeInteger(copy.nextOffset)) copy.nextOffset -= 1;
  }
  if (Buffer.byteLength(JSON.stringify(copy)) <= maximum) return copy;
  if (Array.isArray(copy.preview) && copy.preview.length === 1) {
    const minimal = {
      type: copy.type,
      ...(copy.id ? { id: copy.id } : {}),
      ...(copy.count !== undefined ? { count: copy.count } : {}),
      ...(copy.observation ? { observation: copy.observation } : {}),
      preview: [compactPreviewForSize(copy.preview[0], copy.observation)],
      ...compactObservationForSize(copy),
      ...(copy.offset !== undefined ? { offset: copy.offset } : {}),
      ...(copy.limit !== undefined ? { limit: copy.limit } : {}),
      nextOffset: (copy.offset ?? 0) + 1,
      omittedBefore: copy.offset ?? 0,
      omittedAfter: Math.max(0, (copy.count ?? 1) - (copy.offset ?? 0) - 1),
      omitted: Math.max(0, (copy.count ?? 1) - 1),
      ...sizeBoundMetadata(copy, 1),
      context: {
        bounded: true,
        note: `Secondary presentation details were omitted to preserve the requested preview within the ${maximum}-byte approximate bound.`,
      },
      provenance: [],
    };
    if (Buffer.byteLength(JSON.stringify(minimal)) <= maximum) return minimal;

    const essential = {
      type: copy.type,
      ...(copy.count !== undefined ? { count: copy.count } : {}),
      ...(copy.observation ? { observation: copy.observation } : {}),
      preview: [compactPreviewForSize(copy.preview[0], copy.observation)],
      ...(copy.offset !== undefined ? { offset: copy.offset } : {}),
      ...(copy.limit !== undefined ? { limit: copy.limit } : {}),
      nextOffset: (copy.offset ?? 0) + 1,
      omittedBefore: copy.offset ?? 0,
      omittedAfter: Math.max(0, (copy.count ?? 1) - (copy.offset ?? 0) - 1),
      omitted: Math.max(0, (copy.count ?? 1) - 1),
      ...sizeBoundMetadata(copy, 1),
    };
    if (Buffer.byteLength(JSON.stringify(essential)) <= maximum) return essential;
  }
  return {
    type: copy.type,
    ...(copy.id ? { id: copy.id } : {}),
    ...(copy.count !== undefined ? { count: copy.count } : {}),
    ...(copy.observation ? { observation: copy.observation } : {}),
    preview: [],
    ...compactObservationForSize(copy),
    ...(copy.offset !== undefined ? { offset: copy.offset } : {}),
    ...(copy.limit !== undefined ? { limit: copy.limit } : {}),
    nextOffset: copy.offset ?? 0,
    omittedBefore: copy.offset ?? 0,
    omittedAfter: Math.max(0, (copy.count ?? 0) - (copy.offset ?? 0)),
    omitted: copy.count ?? copy.omitted ?? 0,
    ...sizeBoundMetadata(copy, 0),
    context: { bounded: true, note: `Inspection exceeded the ${maximum}-byte approximate bound.` },
    provenance: [],
  };
}

function markSizeBound(value) {
  Object.assign(value, sizeBoundMetadata(value, value.preview.length));
}

function sizeBoundMetadata(value, returnedItems) {
  return {
    sizeBounded: true,
    requestedItems: value.limit ?? value.preview?.length ?? returnedItems,
    returnedItems,
    boundReason: 'response-size',
  };
}

function compactObservationForSize(value) {
  if (value.observation === 'summary' && value.summary) {
    return { summary: structuredClone(value.summary) };
  }
  if (value.observation === 'coverage' && value.coverage) {
    return { coverage: compactCoverageForSize(value.coverage) };
  }
  return {};
}

function compactCoverageForSize(coverage) {
  const {
    evidenceResolution, partial, exhaustive, uncertainty, unresolvedEvidence,
    completionReason, bounds, sources,
  } = coverage;
  return {
    ...(sources ? { sources } : {}),
    ...(evidenceResolution ? { evidenceResolution } : {}),
    ...(unresolvedEvidence !== undefined ? { unresolvedEvidence } : {}),
    ...(bounds ? { bounds } : {}),
    ...(completionReason ? { completionReason } : {}),
    ...(partial !== undefined ? { partial } : {}),
    ...(exhaustive !== undefined ? { exhaustive } : {}),
    ...(uncertainty ? { uncertainty: excerpt(uncertainty, 120) } : {}),
  };
}

function compactPreviewForSize(value, observation) {
  const copy = structuredClone(value);
  if (observation === 'details') {
    if (copy.evidence) {
      return {
        subject: copy.subject ?? (
          copy.type && copy.id ? { type: copy.type, id: copy.id } : undefined
        ),
        resolved: copy.resolved,
        resolutionSource: copy.resolutionSource,
        evidence: compactEvidenceForSize(copy.evidence),
      };
    }
    if (Array.isArray(copy.subjects)) {
      return {
        subjects: copy.subjects.slice(0, 1).map((item) => ({
          subject: item.subject,
          resolved: item.resolved,
          resolutionSource: item.resolutionSource,
          ...(item.evidence ? { evidence: compactEvidenceForSize(item.evidence) } : {}),
        })),
        omittedSubjects: copy.omittedSubjects,
      };
    }
  }
  if (observation === 'explain') {
    return {
      ...(copy.subject ? { subject: copy.subject } : {}),
      reasons: structuredClone((copy.reasons ?? []).slice(0, 1)),
      omittedReasons: copy.omittedReasons ?? 0,
      provenance: structuredClone((copy.provenance ?? []).slice(0, 1)),
      omittedProvenance: copy.omittedProvenance ?? 0,
    };
  }
  delete copy.notebookEntry;
  delete copy.reasonSummary;
  delete copy.relays;
  if (observation === 'details') {
    delete copy.preview;
    delete copy.context;
    delete copy.provenance;
    delete copy.freshness;
    delete copy.corpus;
    delete copy.omittedProvenance;
  }
  if (observation !== 'details') delete copy.evidence;
  if (observation !== 'explain') {
    delete copy.reasons;
    delete copy.provenance;
  }
  if (observation === 'details' && copy.evidence) {
    copy.evidence = compactEvidenceForSize(copy.evidence);
  }
  if (observation === 'details' && Array.isArray(copy.subjects)) {
    copy.subjects = copy.subjects.slice(0, 1).map((subject) => {
      const compact = structuredClone(subject);
      if (compact.evidence) compact.evidence = compactEvidenceForSize(compact.evidence);
      delete compact.freshness;
      delete compact.corpus;
      return compact;
    });
  }
  if (copy.author) {
    delete copy.author.descriptionExcerpt;
    delete copy.author.relays;
  }
  if (typeof copy.contentExcerpt === 'string') copy.contentExcerpt = excerpt(copy.contentExcerpt, 80);
  if (typeof copy.descriptionExcerpt === 'string') {
    copy.descriptionExcerpt = excerpt(copy.descriptionExcerpt, 80);
  }
  if (copy.values && typeof copy.values === 'object') {
    const compactValues = compactRelationValue(copy.values, 40);
    const preferred = Object.entries(compactValues).filter(([name]) => (
      name.startsWith('match.')
      || name === 'subject.id'
      || name === 'subject.type'
      || name === 'evidence.resolutionSource'
    ));
    copy.values = Object.fromEntries((preferred.length ? preferred : Object.entries(compactValues))
      .slice(0, 6));
  }
  return copy;
}

function compactEvidenceForSize(evidence) {
  const canonical = evidence.event ?? evidence.metadataEvent;
  return {
    ...(canonical ? {
      [evidence.event ? 'event' : 'metadataEvent']: {
        id: canonical.id,
        pubkey: canonical.pubkey,
        created_at: canonical.created_at,
        kind: canonical.kind,
        content: excerpt(canonical.content, 80),
      },
    } : {}),
    observationCount: evidence.observationCount ?? evidence.provenance?.length ?? 0,
  };
}

function excerpt(value, maximum) {
  const text = String(value).replace(/\s+/gu, ' ').trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function isSubject(value) {
  return value && ['event', 'account', 'tag'].includes(value.type)
    && typeof value.id === 'string';
}

function isAcquisition(value) {
  return value && value.requested && value.budget && Array.isArray(value.acquiredObservations)
    && value.counts && Array.isArray(value.relays);
}

function isCorpusSummary(value) {
  return value && Number.isInteger(value.capacity) && Number.isInteger(value.eventCount)
    && Number.isInteger(value.remainingCapacity);
}
