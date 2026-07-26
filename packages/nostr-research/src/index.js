import { randomUUID } from 'node:crypto';
import { validateEvent, verifyEvent } from 'nostr-tools';
import {
  MOVE_ROUTES,
  SUBJECT_COLLECTION_KINDS,
  operationSchema,
  transformOutputKind,
} from './operations.js';

const EVENT_ID = /^[a-f0-9]{64}$/;
const HEX_PREFIX = /^[a-f0-9]{4,64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;
const DEFAULT_QUERY_LIMIT = 50;
const MAX_QUERY_LIMIT = 1000;
const DEFAULT_TRANSFORM_LIMIT = 100;
const SUBJECT_TYPES = new Set(['event', 'account', 'tag', 'set']);
const RETAINABLE_SUBJECT_TYPES = new Set(['event', 'account', 'tag', 'set']);
const NAVIGATION_RELATIONSHIP_TYPES = new Set([
  'author',
  'reply-root',
  'reply-parent',
  'mentioned-event',
  'quoted-event',
  'mentioned-account',
  'follow',
  'topic',
  'other-tag',
]);

export class ResearchMemoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResearchMemoryError';
  }
}

export class InvalidNostrEventError extends ResearchMemoryError {
  constructor(message = 'Event is not a valid canonical Nostr event.') {
    super(message);
    this.name = 'InvalidNostrEventError';
  }
}

/** Creates the authoritative capacity-bounded, process-local research corpus. */
export function createInMemoryResearchMemory(options = {}) {
  assertPlainObject(options, 'In-memory research memory options');
  rejectUnknownKeys(options, new Set(['capacity']), 'in-memory research memory option');
  const capacity = options.capacity;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_QUERY_LIMIT) {
    throw new ResearchMemoryError(
      `In-memory research memory capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }
  return new InMemoryResearchMemory(capacity);
}

/** Creates a minimal stable subject reference. */
export function subject(type, id) {
  if (!SUBJECT_TYPES.has(type)) {
    throw new ResearchMemoryError(`Unsupported subject type: ${type}.`);
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new ResearchMemoryError('Subject ID must be a non-empty string.');
  }
  if (['event', 'account'].includes(type) && !EVENT_ID.test(id)) {
    throw new ResearchMemoryError(`${type} subject ID must be a full 64-character lowercase hexadecimal value.`);
  }
  return { type, id };
}

/** The private indexed owner for canonical records and every derived index. */
class IndexedEventCorpus {
  records = new Map();
  authors = new Map();
  kinds = new Map();
  tags = new Map();
  outbound = new Map();
  inbound = new Map();

  insert(record) {
    const stored = cloneJson(record);
    const { event } = stored;
    const relationships = eventRelationships(event);
    if (this.records.has(event.id)) this.remove(event.id);
    this.records.set(event.id, stored);
    addIndex(this.authors, event.pubkey, event.id);
    addIndex(this.kinds, event.kind, event.id);
    for (const tag of event.tags) {
      if (tag.length > 1) addIndex(this.tags, `${tag[0]}\u0000${tag[1]}`, event.id);
    }
    for (const relationship of relationships) {
      const outbound = {
        direction: 'outbound',
        type: relationship.type,
        sourceEventId: event.id,
        target: subject(relationship.targetType, relationship.targetId),
        evidence: cloneJson(relationship.evidence),
      };
      addRelation(this.outbound, memberKey(subject('event', event.id)), outbound);
      addRelation(this.inbound, memberKey(outbound.target), {
        ...outbound,
        direction: 'inbound',
      });
    }
    return stored;
  }

  remove(eventId) {
    const record = this.records.get(eventId);
    if (!record) return;
    this.records.delete(eventId);
    removeIndex(this.authors, record.event.pubkey, eventId);
    removeIndex(this.kinds, record.event.kind, eventId);
    for (const tag of record.event.tags) {
      if (tag.length > 1) removeIndex(this.tags, `${tag[0]}\u0000${tag[1]}`, eventId);
    }
    const sourceKey = memberKey(subject('event', eventId));
    for (const relation of this.outbound.get(sourceKey) ?? []) {
      const targetKey = memberKey(relation.target);
      const remaining = (this.inbound.get(targetKey) ?? [])
        .filter(({ sourceEventId }) => sourceEventId !== eventId);
      if (remaining.length) this.inbound.set(targetKey, remaining);
      else this.inbound.delete(targetKey);
    }
    this.outbound.delete(sourceKey);
  }

  candidateIds(query, ids, authors) {
    const sets = [];
    if (ids) sets.push(ids);
    if (authors) sets.push(unionIndexes(this.authors, authors));
    if (query.kinds) sets.push(unionIndexes(this.kinds, query.kinds));
    for (const [name, values] of Object.entries(query.tags)) {
      sets.push(unionIndexes(this.tags, values.map((value) => `${name}\u0000${value}`)));
    }
    if (!sets.length) return [...this.records.keys()];
    sets.sort((left, right) => left.size - right.size);
    return [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
  }

  clear() {
    this.records.clear();
    this.authors.clear();
    this.kinds.clear();
    this.tags.clear();
    this.outbound.clear();
    this.inbound.clear();
  }

  describe(capacity, evictions) {
    return {
      capacity,
      eventCount: this.records.size,
      remainingCapacity: capacity - this.records.size,
      evictions,
      authors: this.authors.size,
      kinds: this.kinds.size,
      tags: this.tags.size,
      outboundRelationships: [...this.outbound.values()]
        .reduce((total, relations) => total + relations.length, 0),
      inboundRelationships: [...this.inbound.values()]
        .reduce((total, relations) => total + relations.length, 0),
    };
  }
}

/** The single authoritative bounded process-local research corpus. */
export class InMemoryResearchMemory {
  #capacity;
  #closed = false;
  #corpus = new IndexedEventCorpus();
  #nextObservationId = 1;
  #evictions = 0;
  #sets = new Map();
  #annotations = new Map();

  constructor(capacity) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_QUERY_LIMIT) {
      throw new ResearchMemoryError(
        `In-memory research memory capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
      );
    }
    this.#capacity = capacity;
  }

  #assertOpen() {
    if (this.#closed) throw new ResearchMemoryError('This research memory has already been closed.');
  }

  ingest(event, observation, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'In-memory ingest options');
    rejectUnknownKeys(options, new Set(['preserve']), 'in-memory ingest option');
    const preserve = new Set((options.preserve ?? []).map((item) => {
      const normalized = normalizeSubject(item);
      if (normalized.type !== 'event') {
        throw new ResearchMemoryError('Preserved subjects must be events.');
      }
      return normalized.id;
    }));
    if (preserve.size > this.#capacity) {
      throw new ResearchMemoryError('Research memory capacity cannot accommodate preserved events.');
    }
    assertCanonicalEvent(event);
    const normalized = normalizeObservation(observation);
    // Validation and relationship derivation must complete before owned state changes.
    const canonical = cloneJson(event);
    // Derive before insertion so invalid relationship material cannot cause a
    // partial mutation. IndexedEventCorpus derives again from the owned clone.
    eventRelationships(canonical);
    const stored = this.#corpus.records.has(canonical.id);
    if (!stored) this.#corpus.insert({ event: canonical, observations: [] });
    const recorded = { id: this.#nextObservationId++, ...normalized };
    this.#corpus.records.get(canonical.id).observations.push(recorded);
    const evicted = [];
    if (this.#corpus.records.size > this.#capacity) {
      const oldest = [...this.#corpus.records.keys()].find((id) => !preserve.has(id));
      if (oldest === undefined) {
        throw new ResearchMemoryError('Research memory capacity cannot accommodate preserved events.');
      }
      this.#corpus.remove(oldest);
      this.#evictions += 1;
      evicted.push(oldest);
    }
    return {
      eventId: canonical.id,
      eventStored: !stored,
      observation: cloneJson(recorded),
      ...(evicted.length ? { evicted } : {}),
    };
  }

  getEvent(eventId) {
    this.#assertOpen();
    if (typeof eventId !== 'string' || !EVENT_ID.test(eventId)) {
      throw new ResearchMemoryError('Event ID must be a 64-character lowercase hexadecimal string.');
    }
    const record = this.#corpus.records.get(eventId);
    return record ? cloneJson(record) : null;
  }

  select(query = {}) {
    this.#assertOpen();
    const normalized = normalizeEventQuery(query);
    const events = [...this.#corpus.records.values()].map(({ event }) => event);
    const ids = resolvePrefixes(normalized.ids, events.map(({ id }) => id), 'event ID');
    const authors = resolvePrefixes(
      normalized.authors, events.map(({ pubkey }) => pubkey), 'author public key',
    );
    const candidates = this.#corpus.candidateIds(normalized, ids, authors);
    const results = [];
    for (const eventId of candidates) {
      const { event, observations } = this.#corpus.records.get(eventId);
      const matchReasons = matchEvent(event, normalized, ids, authors);
      if (matchReasons) {
        results.push({
          event, observations, matchReasons,
        });
      }
    }
    results.sort((left, right) => compareEvents(left.event, right.event, normalized.order));
    return resultCollection(results.slice(0, normalized.limit)
      .map(({ event, observations, matchReasons }) => ({
      subject: subject('event', event.id),
      record: { event, observations },
      reasons: matchReasons,
      provenance: observations,
    })), { operation: 'selection', query: publicEventQuery(normalized) }, 'events');
  }

  collection(items, context = {}, kind = undefined) {
    this.#assertOpen();
    if (!Array.isArray(items)) throw new ResearchMemoryError('Collection items must be an array.');
    assertPlainObject(context, 'Collection context');
    const normalized = items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new ResearchMemoryError('Each collection item must be a result item.');
      }
      const normalizedSubject = normalizeSubject(item.subject);
      return {
        subject: normalizedSubject,
        role: item.role,
        reasons: cloneJson(item.reasons ?? []),
        provenance: cloneJson(item.provenance ?? []),
      };
    });
    return resultCollection(normalized, context, kind);
  }

  /**
   * Applies a validated, JSON-serializable sequence of local collection operations.
   * No stage acquires, retains, or otherwise mutates the corpus.
   */
  transform(value, stages) {
    this.#assertOpen();
    const operations = Array.isArray(stages) ? stages : [stages];
    if (operations.length === 0) {
      throw new ResearchMemoryError('A transform requires at least one stage.');
    }
    let current = this.asCollection(value);
    // Validate the complete type path before executing its first stage.
    let kind = current.kind;
    let itemKind = current.itemKind ?? current.kind;
    const normalized = [];
    for (let index = 0; index < operations.length; index += 1) {
      const operation = normalizeTransformOperation(operations[index], kind, itemKind, index);
      normalized.push(operation);
      const output = transformOutputKind(kind, itemKind, operation);
      kind = output.kind;
      itemKind = output.itemKind;
    }
    for (const operation of normalized) current = applyTransform(this, current, operation);
    return current;
  }

  /** Returns the literal public field and operation vocabulary for local pipelines. */
  describeCollectionPipeline() {
    this.#assertOpen();
    return collectionPipelineSchema();
  }

  validateSelection(query) {
    this.#assertOpen();
    normalizeEventQuery(query);
  }

  validateTransform(stages, inputKind, itemKind = inputKind) {
    this.#assertOpen();
    const operations = Array.isArray(stages) ? stages : [stages];
    if (operations.length === 0) {
      throw new ResearchMemoryError('A transform requires at least one stage.');
    }
    let kind = inputKind;
    let memberKind = itemKind;
    for (let index = 0; index < operations.length; index += 1) {
      const operation = normalizeTransformOperation(operations[index], kind, memberKind, index);
      ({ kind, itemKind: memberKind } = transformOutputKind(kind, memberKind, operation));
    }
    return { kind, itemKind: memberKind };
  }

  validateRetention(name, options = {}, collectionKind = undefined) {
    this.#assertOpen();
    normalizeSetName(name);
    assertPlainObject(options, 'Retention options');
    rejectUnknownKeys(options, new Set(['reason']), 'retention option');
    if (options.reason !== undefined) normalizeReason(options.reason);
    if (collectionKind !== undefined) validateRetainableCollectionKind(collectionKind);
  }

  asCollection(value) {
    this.#assertOpen();
    if (value?.type === 'set' || isPublicResearchSet(value)) {
      const retained = this.getSet(value.id);
      return resultCollection(retained.members.map((item) => ({
        subject: subject(item.type, item.id),
        reasons: item.reasons,
        provenance: [],
      })), { operation: 'retained-selection', setId: retained.id });
    }
    if (value?.type === 'result-collection') {
      assertResultCollection(value);
      return resultCollection(value.items.map((item) => this.#resolveCollectionItem(item)),
        value.context, value.kind);
    }
    if (value?.type === 'typed-collection') {
      assertTypedCollection(value);
      if (value.kind === 'groups') {
        return typedCollection('groups', value.items.map((group) => {
          const items = group.items.map((item) => this.#resolveCollectionItem(item));
          const aggregationInputs = cloneJson(group.aggregationInputs ?? {});
          if (aggregationInputs.observedRelay) {
            aggregationInputs.observedRelay = uniqueJson([
              ...aggregationInputs.observedRelay,
              ...items.flatMap((item) => summaryField(item, 'observedRelay') ?? []),
            ]);
          }
          return {
            ...cloneJson(group),
            items,
            aggregationInputs,
            reasons: uniqueJson([
              ...group.reasons,
              ...items.flatMap((item) => item.reasons),
            ]),
            provenance: uniqueJson([
              ...group.provenance,
              ...items.flatMap((item) => item.provenance),
            ]),
          };
        }), value.context, value.itemKind);
      }
      return typedCollection(value.kind, value.items, value.context, value.itemKind);
    }
    if (value?.collection?.type === 'result-collection') return this.asCollection(value.collection);
    throw new ResearchMemoryError('Unsupported public result shape.');
  }

  lookup(reference) {
    this.#assertOpen();
    const item = this.#resolveTyped(normalizeSubject(reference));
    if (!['event', 'account'].includes(item.type)) {
      throw new ResearchMemoryError('Exact lookup supports event and account subjects.');
    }
    const resolved = this.#resolveCollectionItem({
      subject: item,
      reasons: [{ type: 'exact-subject' }],
    });
    return resultCollection([resolved], { operation: 'exact-subject-lookup' },
      item.type === 'event' ? 'events' : 'accounts');
  }

  #resolveCollectionItem(item) {
    const reference = normalizeSubject(item.subject);
    let record;
    if (reference.type === 'event') {
      record = this.getEvent(reference.id);
    } else if (reference.type === 'account') {
      const metadata = this.#currentByKey(reference.id, 0);
      if (metadata) {
        record = {
          profile: parseProfile(metadata.event),
          metadataEvent: metadata.event,
          observations: metadata.observations,
        };
      }
    }
    const provenance = cloneJson(item.provenance ?? []);
    mergeUniqueJson(provenance, record?.observations ?? []);
    return {
      subject: reference,
      role: item.role,
      reasons: cloneJson(item.reasons ?? []),
      ...(record ? { record } : {}),
      provenance,
    };
  }

  resolve(reference, type) {
    this.#assertOpen();
    if (type !== undefined) return this.#resolveTyped({ type, id: reference });
    if (reference && typeof reference === 'object') return this.#resolveTyped(normalizeSubject(reference));
    if (typeof reference !== 'string' || !reference.length) {
      throw new ResearchMemoryError('A subject reference or non-empty account identifier is required.');
    }
    return this.#resolveAccountSubject(reference);
  }

  #resolveTyped(item) {
    if (item.type === 'event') {
      // Full subject references remain meaningful after canonical evidence is
      // evicted; only abbreviated references require resident prefix lookup.
      return EVENT_ID.test(item.id)
        ? subject('event', item.id)
        : subject('event', resolveOnePrefix(item.id, [...this.#corpus.records.keys()], 'event ID'));
    }
    if (item.type === 'account') {
      return EVENT_ID.test(item.id)
        ? subject('account', item.id)
        : this.#resolveAccountSubject(item.id);
    }
    if (item.type === 'set') return subject('set', this.getSet(item.id).id);
    return subject(item.type, item.id);
  }

  #accountKeys() {
    const keys = new Set(this.#corpus.authors.keys());
    for (const relations of this.#corpus.outbound.values()) {
      for (const relation of relations) if (relation.target.type === 'account') keys.add(relation.target.id);
    }
    return [...keys].sort();
  }

  #resolveAccountSubject(identifier) {
    const keys = this.#accountKeys();
    if (HEX_PREFIX.test(identifier)) {
      return subject('account', resolveOnePrefix(identifier, keys, 'account public key'));
    }
    const wanted = identifier.toLocaleLowerCase();
    const matches = keys.filter((key) => {
      const metadata = this.#currentByKey(key, 0);
      if (!metadata) return false;
      const profile = parseProfile(metadata.event);
      return ['name', 'display_name', 'nip05'].some(
        (field) => typeof profile[field] === 'string'
          && profile[field].toLocaleLowerCase() === wanted,
      );
    });
    if (!matches.length) throw new ResearchMemoryError(`No stored account matches ${identifier}.`);
    if (matches.length > 1) {
      throw new ResearchMemoryError(
        `Ambiguous stored account identifier ${identifier}: ${matches.length} accounts match.`,
      );
    }
    return subject('account', matches[0]);
  }

  #currentByKey(publicKey, kind, d = '') {
    const candidates = [...(this.#corpus.authors.get(publicKey) ?? [])]
      .map((id) => this.#corpus.records.get(id))
      .filter(({ event }) => event.kind === kind
        && (kind < 30000 || (event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '') === d))
      .sort((left, right) => right.event.created_at - left.event.created_at
        || left.event.id.localeCompare(right.event.id));
    return candidates[0] ? cloneJson(candidates[0]) : null;
  }

  currentEvent(account, kind, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'Current event options');
    rejectUnknownKeys(options, new Set(['d']), 'current event option');
    if (!isReplaceableKind(kind)) {
      throw new ResearchMemoryError(
        'Current event kind must be 0, 3, 10000-19999, or 30000-39999.',
      );
    }
    const owner = account && typeof account === 'object'
      ? this.resolve(account) : this.resolve(account, 'account');
    if (kind >= 30000 && kind < 40000 && options.d !== undefined && typeof options.d !== 'string') {
      throw new ResearchMemoryError('Current event d must be a string.');
    }
    if (kind < 30000 && options.d !== undefined) {
      throw new ResearchMemoryError('Current event d applies only to kinds 30000-39999.');
    }
    return this.#currentByKey(owner.id, kind, options.d ?? '');
  }

  follows(account) {
    const owner = account && typeof account === 'object'
      ? this.resolve(account) : this.resolve(account, 'account');
    const contact = this.#currentByKey(owner.id, 3);
    if (!contact) return resultCollection([], {
      operation: 'follows', account: owner, currentContactListEventId: null,
      explanation: 'No current stored kind-3 contact list.', relationships: [],
    }, 'accounts');
    const traversed = this.traverse([subject('event', contact.event.id)], {
      relationshipTypes: ['follow'], direction: 'outbound', depth: 1, limit: MAX_QUERY_LIMIT,
    });
    return resultCollection(traversed.items.filter(({ subject: item }) => item.type === 'account')
      .map((item) => ({ ...item, provenance: contact.observations })), {
      operation: 'follows', account: owner, currentContactListEventId: contact.event.id,
      relationships: traversed.context.relationships,
    });
  }

  connections(starting, options = {}) {
    this.#assertOpen();
    const normalized = normalizeConnectionOptions(options);
    const seeds = this.asCollection(starting).items.map(({ subject: item }) => (
      this.#resolveTyped(item)
    ));
    const seedKeys = new Set(seeds.map(memberKey));
    const candidates = new Map();

    for (const seed of seeds) {
      const related = [];
      const relationshipTypes = [...normalized.relationshipTypes];
      if (seed.type === 'account' && normalized.direction === 'outbound') {
        const followIndex = relationshipTypes.indexOf('follow');
        if (followIndex !== -1) {
          related.push(...this.follows(seed).items);
          relationshipTypes.splice(followIndex, 1);
        }
      }
      if (relationshipTypes.length) {
        related.push(...this.traverse([seed], {
          relationshipTypes,
          direction: normalized.direction,
          depth: 1,
          limit: MAX_QUERY_LIMIT,
        }).items);
      }
      for (const item of related) {
        const key = memberKey(item.subject);
        if (key === memberKey(seed) || seedKeys.has(key)) continue;
        const candidate = candidates.get(key) ?? {
          subject: item.subject,
          role: 'discovery',
          sources: new Map(),
          provenance: [],
        };
        const sourceKey = memberKey(seed);
        const source = candidate.sources.get(sourceKey) ?? { seed, reasons: [] };
        mergeUniqueJson(source.reasons, item.reasons);
        candidate.sources.set(sourceKey, source);
        mergeUniqueJson(candidate.provenance, item.provenance);
        candidates.set(key, candidate);
      }
    }

    const ranked = [...candidates.values()]
      .filter(({ sources }) => sources.size >= normalized.minimumSources)
      .sort((left, right) => (
        right.sources.size - left.sources.size
        || memberKey(left.subject).localeCompare(memberKey(right.subject))
      ))
      .slice(0, normalized.limit)
      .map((candidate) => ({
        subject: candidate.subject,
        role: candidate.role,
        reasons: [{
          type: 'connection-aggregation',
          sourceCount: candidate.sources.size,
          sources: [...candidate.sources.values()],
        }],
        provenance: candidate.provenance,
      }));

    return resultCollection(ranked, {
      operation: 'connection-aggregation',
      starts: seeds,
      relationshipTypes: normalized.relationshipTypes,
      direction: normalized.direction,
      minimumSources: normalized.minimumSources,
      limit: normalized.limit,
    });
  }

  traverse(starting, options = {}) {
    this.#assertOpen();
    const normalized = normalizeTraversal(options);
    const starts = expandStartingSubjects(this, starting).map((item) => this.#resolveTyped(item));
    const queue = starts.map((item) => ({ subject: item, depth: 0 }));
    const visited = new Map(starts.map((item) => [memberKey(item), {
      subject: item, role: 'seed', reasons: [{ type: 'traversal-start' }], provenance: [],
    }]));
    const relationships = [];
    const edgeKeys = new Set();
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= normalized.depth) continue;
      const relations = [
        ...(normalized.direction !== 'inbound'
          ? this.#corpus.outbound.get(memberKey(current.subject)) ?? [] : []),
        ...(normalized.direction !== 'outbound'
          ? this.#corpus.inbound.get(memberKey(current.subject)) ?? [] : []),
      ].sort((left, right) => (
        left.direction.localeCompare(right.direction)
        || left.sourceEventId.localeCompare(right.sourceEventId)
        || left.type.localeCompare(right.type)
        || left.target.id.localeCompare(right.target.id)
      ));
      for (const relation of relations) {
        if (!normalized.relationshipTypes.includes(relation.type)) continue;
        const next = relation.direction === 'outbound'
          ? relation.target : subject('event', relation.sourceEventId);
        const depth = current.depth + 1;
        const edge = {
          source: current.subject, target: next, direction: relation.direction,
          type: relation.type, depth, sourceEventId: relation.sourceEventId,
          evidence: relation.evidence,
        };
        if (!edgeKeys.has(stableJson(edge))) {
          edgeKeys.add(stableJson(edge));
          relationships.push(edge);
        }
        const reason = {
          type: 'relationship', relationshipType: relation.type,
          direction: relation.direction, depth, source: current.subject,
          sourceEventId: relation.sourceEventId, evidence: relation.evidence,
        };
        const key = memberKey(next);
        if (!visited.has(key) && visited.size - starts.length < normalized.limit) {
          visited.set(key, {
            subject: next, role: 'discovery', reasons: [reason],
            provenance: cloneJson(
              this.#corpus.records.get(relation.sourceEventId)?.observations ?? [],
            ),
          });
          queue.push({ subject: next, depth });
        } else if (visited.has(key)) {
          const item = visited.get(key);
          if (!item.reasons.some((existing) => stableJson(existing) === stableJson(reason))) {
            item.reasons.push(reason);
          }
        }
      }
    }
    relationships.sort(compareTraversalEdges);
    return resultCollection([...visited.values()], {
      operation: 'traversal', starts, relationshipTypes: normalized.relationshipTypes,
      direction: normalized.direction, depth: normalized.depth,
      limit: normalized.limit, relationships,
    });
  }

  inspect(reference) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    if (item.type === 'event') {
      const record = this.getEvent(item.id);
      return {
        subject: item, resident: Boolean(record), evidence: record,
        provenance: record?.observations ?? [],
        relationships: cloneJson(this.#corpus.outbound.get(memberKey(item)) ?? []),
      };
    }
    if (item.type === 'account') {
      const metadata = this.#currentByKey(item.id, 0);
      const evidence = metadata ? {
        profile: parseProfile(metadata.event),
        metadataEvent: metadata.event,
        observations: metadata.observations,
      } : null;
      return {
        subject: item,
        resident: Boolean(evidence),
        evidence,
        provenance: evidence?.observations ?? [],
      };
    }
    const collection = this.traverse([item], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: this.#capacity,
    });
    return { subject: item, resident: collection.context.relationships.length > 0, collection };
  }

  annotate(reference, value) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    const annotation = normalizeAnnotation(value);
    const key = memberKey(item);
    const existing = this.#annotations.get(key);
    const now = new Date().toISOString();
    const stored = {
      subject: item,
      labels: annotation.labels,
      note: annotation.note,
      ...(annotation.judgment === undefined ? {} : { judgment: annotation.judgment }),
      ...(annotation.strength === undefined ? {} : { strength: annotation.strength }),
      ...(annotation.reason === undefined ? {} : { reason: annotation.reason }),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.#annotations.set(key, stored);
    return cloneJson(stored);
  }

  getAnnotation(reference) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    return cloneJson(this.#annotations.get(memberKey(item)) ?? null);
  }

  annotated(query = {}) {
    this.#assertOpen();
    const normalized = normalizeAnnotationQuery(query);
    const items = [...this.#annotations.values()]
      .filter((annotation) => normalized.labels.every(
        (label) => annotation.labels.includes(label),
      ))
      .filter((annotation) => normalized.judgments.length === 0
        || normalized.judgments.includes(annotation.judgment))
      .sort((left, right) => (
        right.updatedAt.localeCompare(left.updatedAt)
        || memberKey(left.subject).localeCompare(memberKey(right.subject))
      ))
      .slice(0, normalized.limit)
      .map((annotation) => ({
        subject: annotation.subject,
        role: 'discovery',
        reasons: [{ type: 'annotation', annotation }],
        provenance: [],
      }));
    return resultCollection(items, {
      operation: 'annotation-query',
      labels: normalized.labels,
      judgments: normalized.judgments,
      limit: normalized.limit,
    });
  }

  removeAnnotation(reference) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    return { subject: item, removed: this.#annotations.delete(memberKey(item)) };
  }

  #createPopulatedSet(name, entries, options = {}) {
    this.#assertOpen();
    const members = new Map();
    for (const entry of entries) {
      if (options.signal?.aborted) {
        throw new ResearchMemoryError('Populated set creation was interrupted.');
      }
      const member = normalizeMember(entry.member);
      const key = memberKey(member);
      const found = members.get(key) ?? { ...member, reasons: [] };
      for (const reason of entry.reasons) {
        const normalized = normalizeReason(reason);
        if (!found.reasons.some((item) => stableJson(item) === stableJson(normalized))) {
          found.reasons.push(normalized);
        }
      }
      members.set(key, found);
    }
    const record = {
      id: randomUUID(), name: normalizeSetName(name), createdAt: new Date().toISOString(),
      members: [...members.values()].sort((a, b) => memberKey(a).localeCompare(memberKey(b))),
    };
    this.#sets.set(record.id, cloneJson(record));
    const summary = this.#setSummary(record, 10);
    return {
      id: summary.id, name: summary.name, createdAt: summary.createdAt,
      memberCount: summary.memberCount, reasonCount: summary.reasonCount,
      preview: summary.preview,
    };
  }

  #setSummary(set, previewLimit = 5) {
    const counts = Object.fromEntries([...RETAINABLE_SUBJECT_TYPES].map((type) => [type, 0]));
    for (const member of set.members) counts[member.type] += 1;
    return {
      id: set.id, name: set.name, createdAt: set.createdAt,
      memberCount: set.members.length,
      reasonCount: set.members.reduce((total, item) => total + item.reasons.length, 0),
      counts, preview: set.members.slice(0, previewLimit).map(({ type, id }) => ({ type, id })),
    };
  }

  getSet(id) {
    this.#assertOpen();
    const set = this.#sets.get(id);
    if (!set) throw new ResearchMemoryError(`No research set found for ID ${id}.`);
    return cloneJson(set);
  }

  listSets() {
    this.#assertOpen();
    return [...this.#sets.values()]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((set) => this.#setSummary(set));
  }

  renameSet(id, name) {
    const set = this.getSet(id);
    set.name = normalizeSetName(name);
    this.#sets.set(id, set);
    return cloneJson(set);
  }

  replaceSet(id, collection, options = {}) {
    const previous = this.getSet(id);
    collection = this.asCollection(collection);
    validateRetainableCollectionKind(collection.kind);
    assertPlainObject(options, 'Retained selection replacement options');
    rejectUnknownKeys(options, new Set(['name', 'reason']), 'retained selection replacement options');
    const retentionContext = options.reason ? normalizeReason(options.reason) : undefined;
    const entries = collection.items
      .filter((item) => RETAINABLE_SUBJECT_TYPES.has(item.subject.type))
      .map((item) => ({
        member: item.subject,
        reasons: (item.reasons.length ? item.reasons : [{ type: 'retained-result' }])
          .map((reason) => ({
            ...reason, ...(retentionContext ? { retentionContext } : {}),
            operation: collection.context.operation, provenance: retainedProvenance(item),
          })),
      }));
    const members = new Map();
    for (const entry of entries) {
      const member = normalizeMember(entry.member);
      const key = memberKey(member);
      const found = members.get(key) ?? { ...member, reasons: [] };
      for (const reason of entry.reasons.map(normalizeReason)) {
        if (!found.reasons.some((item) => stableJson(item) === stableJson(reason))) {
          found.reasons.push(reason);
        }
      }
      members.set(key, found);
    }
    const replacement = {
      id,
      name: options.name === undefined ? previous.name : normalizeSetName(options.name),
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
      members: [...members.values()].sort((a, b) => memberKey(a).localeCompare(memberKey(b))),
    };
    this.#sets.set(id, cloneJson(replacement));
    return this.#setSummary(replacement, 10);
  }

  deleteSet(id) {
    this.getSet(id);
    this.#sets.delete(id);
    return { id, deleted: true };
  }

  retain(collection, name, options = {}) {
    collection = this.asCollection(collection);
    validateRetainableCollectionKind(collection.kind);
    assertPlainObject(options, 'Retention options');
    const retentionContext = options.reason ? normalizeReason(options.reason) : undefined;
    return this.#createPopulatedSet(name, collection.items
      .filter((item) => RETAINABLE_SUBJECT_TYPES.has(item.subject.type))
      .map((item) => ({
        member: item.subject,
        reasons: (item.reasons.length ? item.reasons : [{ type: 'retained-result' }])
          .map((reason) => ({
            ...reason, ...(retentionContext ? { retentionContext } : {}),
            operation: collection.context.operation, provenance: retainedProvenance(item),
          })),
      })), { signal: options.signal });
  }

  project(value, options = {}) {
    this.#assertOpen();
    const mode = options.mode ?? 'compact';
    if (!['compact', 'full', 'ids', 'ndjson'].includes(mode)) {
      throw new ResearchMemoryError('Projection mode must be compact, full, ids, or ndjson.');
    }
    const collection = value?.type === 'result-collection'
      ? this.asCollection(value) : coerceCollection(value);
    const results = collection.items.map((item) => {
      const reference = item.subject;
      let projection;
      if (mode === 'ids') projection = reference;
      else if (reference.type === 'event') {
        const record = this.getEvent(reference.id);
        projection = record ? (mode === 'full'
          ? { type: 'event', id: reference.id, ...record }
          : {
              type: 'event', id: reference.id, kind: record.event.kind,
              author: this.#accountSummary(record.event.pubkey, options.excerptLimit ?? 160),
              createdAt: record.event.created_at,
              contentExcerpt: excerpt(record.event.content, options.excerptLimit ?? 160),
              relayCount: distinctRelays(record.observations).length,
              relays: distinctRelays(record.observations),
            }) : { type: 'event', id: reference.id, resolved: false };
      } else if (reference.type === 'account') {
        const summary = this.#accountSummary(reference.id, options.excerptLimit ?? 160);
        const metadata = this.#currentByKey(reference.id, 0);
        projection = {
          type: 'account', id: reference.id, resolved: Boolean(metadata), ...summary,
          ...(mode === 'full' && metadata ? {
            profile: parseProfile(metadata.event),
            metadataEvent: metadata.event, observations: metadata.observations,
          } : {}),
        };
      } else if (reference.type === 'set') {
        projection = mode === 'full'
          ? { type: 'set', ...this.getSet(reference.id) }
          : { type: 'set', ...this.#setSummary(this.getSet(reference.id)) };
      } else projection = reference;
      return {
        ...projection,
        ...(this.#annotations.has(memberKey(reference))
          ? { annotation: cloneJson(this.#annotations.get(memberKey(reference))) } : {}),
        role: item.role ?? 'discovery',
        reasons: cloneJson(item.reasons), provenance: cloneJson(item.provenance),
      };
    });
    if (mode === 'ids') return results.map(({ type, id }) => ({ type, id }));
    const output = {
      type: 'result-collection', context: cloneJson(collection.context), results,
      ...((collection.context.relationships ?? []).length
        ? { relationships: cloneJson(collection.context.relationships) } : {}),
    };
    return mode === 'ndjson'
      ? [{ type: 'collection', context: output.context, resultCount: results.length }, ...results]
      : output;
  }

  #accountSummary(publicKey, excerptLimit = 160) {
    const metadata = this.#currentByKey(publicKey, 0);
    const profile = metadata ? parseProfile(metadata.event) : {};
    const observations = [...(this.#corpus.authors.get(publicKey) ?? [])]
      .flatMap((eventId) => this.#corpus.records.get(eventId)?.observations ?? []);
    return {
      publicKey, name: profile.name, displayName: profile.display_name, nip05: profile.nip05,
      descriptionExcerpt: typeof profile.about === 'string'
        ? excerpt(profile.about, excerptLimit) : undefined,
      metadataEventId: metadata?.event.id,
      relays: distinctRelays(observations),
    };
  }

  describe() {
    this.#assertOpen();
    return this.#corpus.describe(this.#capacity, this.#evictions);
  }

  reset() {
    this.#assertOpen();
    this.#corpus.clear();
    this.#sets.clear();
    this.#annotations.clear();
    this.#nextObservationId = 1; this.#evictions = 0;
  }

  close() {
    if (!this.#closed) {
      this.reset();
      this.#closed = true;
    }
  }
}

export function isCanonicalNostrEvent(event) {
  if (!event || typeof event !== 'object') return false;
  // REPL and future adapter values may originate in another JavaScript realm.
  // Normalize the plain protocol value before passing it to nostr-tools.
  let candidate;
  try {
    candidate = cloneJson(event);
  } catch {
    return false;
  }
  if (!validateEvent(candidate)) return false;
  if (!EVENT_ID.test(candidate.id) || !SIGNATURE.test(candidate.sig)) return false;
  if (!Number.isSafeInteger(candidate.kind) || candidate.kind < 0) return false;
  if (!Number.isSafeInteger(candidate.created_at) || candidate.created_at < 0) return false;
  // nostr-tools memoizes verification on the object it receives. Verify a
  // shallow copy so validating evidence never annotates the caller's object.
  return verifyEvent(candidate);
}

function assertCanonicalEvent(event) {
  if (!isCanonicalNostrEvent(event)) {
    throw new InvalidNostrEventError();
  }
}

function normalizeObservation(observation) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new ResearchMemoryError('An observation with a relay is required.');
  }
  if (typeof observation.relay !== 'string' || observation.relay.trim().length === 0) {
    throw new ResearchMemoryError('Observation relay must be a non-empty string.');
  }

  const observedAt = observation.observedAt ?? new Date().toISOString();
  if (typeof observedAt !== 'string' || Number.isNaN(Date.parse(observedAt))) {
    throw new ResearchMemoryError('Observation observedAt must be a valid ISO-8601 timestamp.');
  }

  return {
    relay: observation.relay,
    observedAt: new Date(observedAt).toISOString(),
  };
}

function isReplaceableKind(kind) {
  return Number.isSafeInteger(kind)
    && (kind === 0 || kind === 3
      || (kind >= 10000 && kind < 20000)
      || (kind >= 30000 && kind < 40000));
}

function normalizeEventQuery(query) {
  assertPlainObject(query, 'Event query');
  const allowed = new Set(['ids', 'authors', 'kinds', 'since', 'until', 'tags', 'text', 'limit', 'order']);
  rejectUnknownKeys(query, allowed, 'event query');
  const ids = normalizeStringList(query.ids, 'ids', true);
  const authors = normalizeStringList(query.authors, 'authors', true);
  const kinds = normalizeIntegerList(query.kinds, 'kinds');
  const since = normalizeTimestamp(query.since, 'since');
  const until = normalizeTimestamp(query.until, 'until');
  if (since !== undefined && until !== undefined && since > until) {
    throw new ResearchMemoryError('Event query since must be less than or equal to until.');
  }
  const tags = normalizeTags(query.tags);
  const terms = normalizeStringList(query.text, 'text', false) ?? [];
  const limit = normalizeLimit(query.limit);
  const order = query.order ?? 'newest';
  if (!['newest', 'oldest'].includes(order)) {
    throw new ResearchMemoryError('Event query order must be "newest" or "oldest".');
  }
  return { ids, authors, kinds, since, until, tags, terms, limit, order };
}

function normalizeTags(tags) {
  if (tags === undefined) return {};
  assertPlainObject(tags, 'Event query tags');
  const normalized = {};
  for (const [name, values] of Object.entries(tags)) {
    const tagName = name.startsWith('#') ? name.slice(1) : name;
    if (!/^[A-Za-z]$/.test(tagName)) {
      throw new ResearchMemoryError(`Tag constraint ${name} must name one single-letter Nostr tag.`);
    }
    normalized[tagName] = [
      ...(normalized[tagName] ?? []),
      ...normalizeStringList(values, `tags.${name}`, false),
    ];
    normalized[tagName] = [...new Set(normalized[tagName])];
  }
  return normalized;
}

function normalizeStringList(value, name, hex) {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) throw new ResearchMemoryError(`${name} must not be empty.`);
  for (const item of values) {
    if (typeof item !== 'string' || item.length === 0) {
      throw new ResearchMemoryError(`${name} values must be non-empty strings.`);
    }
    if (hex && !HEX_PREFIX.test(item)) {
      throw new ResearchMemoryError(`${name} values must be 4 to 64 lowercase hexadecimal characters.`);
    }
  }
  return [...new Set(values)];
}

function normalizeIntegerList(value, name) {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0 || values.some((item) => !Number.isSafeInteger(item) || item < 0)) {
    throw new ResearchMemoryError(`${name} must contain non-negative safe integers.`);
  }
  return [...new Set(values)];
}

function normalizeTimestamp(value, name) {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ResearchMemoryError(`${name} must be a non-negative Unix timestamp integer.`);
  }
  return value;
}

function normalizeLimit(value) {
  if (value === undefined) return DEFAULT_QUERY_LIMIT;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_QUERY_LIMIT) {
    throw new ResearchMemoryError(`limit must be an integer from 1 to ${MAX_QUERY_LIMIT}.`);
  }
  return value;
}

function normalizeTraversal(options) {
  assertPlainObject(options, 'Traversal options');
  rejectUnknownKeys(
    options, new Set(['relationshipTypes', 'direction', 'depth', 'limit']),
    'traversal option',
  );
  const relationshipTypes = normalizeStringList(
    options.relationshipTypes, 'relationshipTypes', false,
  );
  if (!relationshipTypes) throw new ResearchMemoryError('Traversal relationshipTypes are required.');
  const unsupported = relationshipTypes.filter((type) => !NAVIGATION_RELATIONSHIP_TYPES.has(type));
  if (unsupported.length) {
    throw new ResearchMemoryError(`Unsupported traversal relationship types: ${unsupported.join(', ')}.`);
  }
  const direction = options.direction ?? 'outbound';
  if (!['inbound', 'outbound', 'both'].includes(direction)) {
    throw new ResearchMemoryError('Traversal direction must be "inbound", "outbound", or "both".');
  }
  const depth = options.depth ?? 1;
  if (!Number.isSafeInteger(depth) || depth < 1 || depth > 100) {
    throw new ResearchMemoryError('Traversal depth must be an integer from 1 to 100.');
  }
  return {
    relationshipTypes,
    direction,
    depth,
    limit: normalizeLimit(options.limit),
  };
}

function normalizeConnectionOptions(options) {
  assertPlainObject(options, 'Connection aggregation options');
  rejectUnknownKeys(
    options, new Set(['relationshipTypes', 'direction', 'minimumSources', 'limit']),
    'connection aggregation option',
  );
  const traversal = normalizeTraversal({
    relationshipTypes: options.relationshipTypes,
    direction: options.direction,
    depth: 1,
    limit: MAX_QUERY_LIMIT,
  });
  const minimumSources = options.minimumSources ?? 1;
  if (!Number.isSafeInteger(minimumSources) || minimumSources < 1 || minimumSources > MAX_QUERY_LIMIT) {
    throw new ResearchMemoryError(
      `Connection aggregation minimumSources must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }
  return {
    relationshipTypes: traversal.relationshipTypes,
    direction: traversal.direction,
    minimumSources,
    limit: normalizeLimit(options.limit),
  };
}

function resolvePrefixes(prefixes, candidates, label) {
  if (!prefixes) return null;
  const resolved = new Set();
  const uniqueCandidates = [...new Set(candidates)];
  for (const prefix of prefixes) {
    const matches = uniqueCandidates.filter((candidate) => candidate.startsWith(prefix));
    if (matches.length > 1) {
      throw new ResearchMemoryError(`Ambiguous ${label} prefix ${prefix}: ${matches.length} stored values match.`);
    }
    if (matches.length === 1) resolved.add(matches[0]);
  }
  return resolved;
}

function addIndex(index, key, eventId) {
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(eventId);
}

function removeIndex(index, key, eventId) {
  const values = index.get(key);
  if (!values) return;
  values.delete(eventId);
  if (values.size === 0) index.delete(key);
}

function unionIndexes(index, keys) {
  const values = new Set();
  for (const key of keys) {
    for (const eventId of index.get(key) ?? []) values.add(eventId);
  }
  return values;
}

function addRelation(index, key, relationship) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(relationship);
}

function resolveOnePrefix(prefix, candidates, label) {
  const normalized = normalizeStringList(prefix, label, true)[0];
  const matches = [...new Set(candidates)].filter((candidate) => candidate.startsWith(normalized));
  if (matches.length === 0) throw new ResearchMemoryError(`No stored ${label} matches ${normalized}.`);
  if (matches.length > 1) {
    throw new ResearchMemoryError(`Ambiguous ${label} prefix ${normalized}: ${matches.length} stored values match.`);
  }
  return matches[0];
}

function matchEvent(event, query, ids, authors) {
  const reasons = [];
  if (ids) {
    if (!ids.has(event.id)) return null;
    reasons.push({ type: 'event-id', value: event.id });
  }
  if (authors) {
    if (!authors.has(event.pubkey)) return null;
    reasons.push({ type: 'author', value: event.pubkey });
  }
  if (query.kinds) {
    if (!query.kinds.includes(event.kind)) return null;
    reasons.push({ type: 'kind', value: event.kind });
  }
  if (query.since !== undefined) {
    if (event.created_at < query.since) return null;
    reasons.push({ type: 'created-at-since', value: query.since });
  }
  if (query.until !== undefined) {
    if (event.created_at > query.until) return null;
    reasons.push({ type: 'created-at-until', value: query.until });
  }
  for (const [name, values] of Object.entries(query.tags)) {
    const matchedValues = values.filter(
      (value) => event.tags.some((tag) => tag[0] === name && tag[1] === value),
    );
    if (matchedValues.length === 0) return null;
    reasons.push({ type: 'tag', tag: `#${name}`, values: matchedValues });
  }
  for (const term of query.terms) {
    if (!event.content.toLocaleLowerCase().includes(term.toLocaleLowerCase())) return null;
    reasons.push({ type: 'text', term });
  }
  return reasons;
}

function compareEvents(left, right, order) {
  const time = order === 'newest'
    ? right.created_at - left.created_at
    : left.created_at - right.created_at;
  return time || left.id.localeCompare(right.id);
}

function publicEventQuery(query) {
  return {
    ids: query.ids,
    authors: query.authors,
    kinds: query.kinds,
    since: query.since,
    until: query.until,
    tags: query.tags,
    text: query.terms,
    limit: query.limit,
    order: query.order,
  };
}

function parseProfile(event) {
  try {
    const profile = JSON.parse(event.content);
    return profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
  } catch {
    return {};
  }
}

function resultCollection(items, context = {}, explicitKind) {
  const kind = explicitKind ?? inferSubjectCollectionKind(items);
  return {
    type: 'result-collection',
    kind,
    items: items.map((item) => ({
      subject: normalizeSubject(item.subject),
      role: item.role === 'seed' ? 'seed' : 'discovery',
      ...(item.record ? { record: cloneJson(item.record) } : {}),
      reasons: cloneJson(item.reasons ?? []),
      provenance: cloneJson(item.provenance ?? []),
    })),
    context: cloneJson(context),
  };
}

function assertResultCollection(value) {
  if (!value || value.type !== 'result-collection' || !Array.isArray(value.items)) {
    throw new ResearchMemoryError('A reusable result collection is required.');
  }
  value.items.forEach((item) => normalizeSubject(item.subject));
  const inferred = inferSubjectCollectionKind(value.items);
  if (value.items.length > 0 && value.kind !== undefined && value.kind !== inferred) {
    throw new ResearchMemoryError(
      `Result collection kind ${value.kind} does not match its ${inferred} items.`,
    );
  }
}

function assertTypedCollection(value) {
  if (!value || value.type !== 'typed-collection' || !Array.isArray(value.items)) {
    throw new ResearchMemoryError('A reusable typed collection is required.');
  }
  assertPlainObject(value.context, 'Typed collection context');
  if (value.kind === 'groups') {
    if (!TRANSFORM_KINDS.has(value.itemKind)) {
      throw new ResearchMemoryError('A groups collection requires a supported itemKind.');
    }
    value.items.forEach((group) => {
      assertPlainObject(group, 'Group item');
      if (!Array.isArray(group.items) || !Array.isArray(group.reasons)
          || !Array.isArray(group.provenance)) {
        throw new ResearchMemoryError(
          'Group items require items, reasons, and provenance arrays.',
        );
      }
      group.items.forEach((item) => normalizeSubject(item.subject));
      const inferred = inferSubjectCollectionKind(group.items);
      if (group.items.length > 0 && inferred !== value.itemKind) {
        throw new ResearchMemoryError(
          `Group itemKind ${value.itemKind} does not match its ${inferred} items.`,
        );
      }
    });
    return;
  }
  if (value.kind === 'summaries') {
    if (value.itemKind !== 'summaries') {
      throw new ResearchMemoryError('A summaries collection requires summaries itemKind.');
    }
    value.items.forEach((summary) => {
      assertPlainObject(summary, 'Summary item');
      assertPlainObject(summary.values, 'Summary values');
      if (!Array.isArray(summary.reasons) || !Array.isArray(summary.provenance)) {
        throw new ResearchMemoryError(
          'Summary items require reasons and provenance arrays.',
        );
      }
    });
    return;
  }
  if (value.kind === 'projections') {
    if (!TRANSFORM_KINDS.has(value.itemKind)) {
      throw new ResearchMemoryError('A projections collection requires a supported itemKind.');
    }
    value.items.forEach((projection) => {
      normalizeSubject(projection.subject);
      assertPlainObject(projection.values, 'Projection values');
      if (!Array.isArray(projection.reasons) || !Array.isArray(projection.provenance)) {
        throw new ResearchMemoryError(
          'Projection items require reasons and provenance arrays.',
        );
      }
    });
    return;
  }
  throw new ResearchMemoryError(`Unsupported typed collection kind: ${value.kind}.`);
}

function inferSubjectCollectionKind(items) {
  const types = new Set(items.map((item) => normalizeSubject(item.subject).type));
  if (types.size === 0) return 'subjects';
  if (types.size > 1) return 'subjects';
  const type = [...types][0];
  return type === 'event' ? 'events'
    : type === 'account' ? 'accounts'
      : 'relationships';
}

function coerceCollection(value) {
  if (value?.type === 'result-collection') {
    assertResultCollection(value);
    return value;
  }
  const values = Array.isArray(value) ? value : [value];
  return resultCollection(values.map((item) => ({ subject: normalizeSubject(item) })), {
    operation: 'projection',
  });
}

function normalizeSubject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ResearchMemoryError('Subject reference must be an object.');
  }
  return subject(value.type, value.id);
}

function expandStartingSubjects(memory, starting) {
  const value = starting?.type === 'result-collection'
    ? starting.items.map(({ subject: item }) => item)
    : Array.isArray(starting) ? starting : [starting];
  const expanded = [];
  for (const raw of value) {
    const item = normalizeSubject(raw);
    if (item.type === 'set') {
      expanded.push(...memory.getSet(item.id).members.map(({ type, id }) => subject(type, id)));
    } else {
      expanded.push(item);
    }
  }
  return uniqueSubjects(expanded);
}

function compareTraversalEdges(left, right) {
  return left.depth - right.depth
    || memberKey(left.source).localeCompare(memberKey(right.source))
    || left.direction.localeCompare(right.direction)
    || left.type.localeCompare(right.type)
    || memberKey(left.target).localeCompare(memberKey(right.target))
    || left.sourceEventId.localeCompare(right.sourceEventId);
}

function uniqueSubjects(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = memberKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distinctRelays(observations) {
  return [...new Set(observations.map(({ relay }) => relay))].sort();
}

function excerpt(content, maximum) {
  const singleLine = content.replace(/\s+/gu, ' ').trim();
  return singleLine.length <= maximum ? singleLine : `${singleLine.slice(0, maximum - 1)}…`;
}

function normalizeProjectionLimit(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000) {
    throw new ResearchMemoryError(`${label} must be an integer from 1 to 1000.`);
  }
  return value;
}

function eventRelationships(event) {
  const relationships = [{
    type: 'author',
    targetType: 'account',
    targetId: event.pubkey,
    evidence: { interpretation: 'known', protocol: 'NIP-01', field: 'pubkey' },
  }];
  const eTags = event.tags
    .map((tag, index) => ({ tag, index }))
    .filter(({ tag }) => tag[0] === 'e' && EVENT_ID.test(tag[1]));
  const marked = eTags.filter(({ tag }) => ['root', 'reply', 'mention'].includes(tag[3]));
  const nip22Root = event.kind === 1111
    ? event.tags.findIndex((tag) => tag[0] === 'E' && EVENT_ID.test(tag[1]))
    : -1;

  for (const { tag, index } of eTags) {
    let type;
    let interpretation = 'known';
    let protocol = 'NIP-10';
    if (nip22Root >= 0 && tag[3] === undefined) {
      type = 'reply-parent';
      protocol = 'NIP-22';
    } else if (tag[3] === 'root') type = 'reply-root';
    else if (tag[3] === 'reply') type = 'reply-parent';
    else if (tag[3] === 'mention') type = 'mentioned-event';
    else if (marked.length === 0) {
      if (eTags.length === 1 || index === eTags[0].index) type = 'reply-root';
      else if (index === eTags.at(-1).index) type = 'reply-parent';
      else type = 'mentioned-event';
      interpretation = 'best-effort-fallback';
    } else {
      type = 'mentioned-event';
      interpretation = 'best-effort-fallback';
    }
    relationships.push(tagRelationship(type, 'event', tag[1], tag, index, protocol, interpretation));
    if (eTags.length === 1 && marked.length === 0 && nip22Root < 0) {
      relationships.push(tagRelationship(
        'reply-parent', 'event', tag[1], tag, index, protocol, interpretation,
      ));
    }
  }
  if (nip22Root >= 0) {
    const tag = event.tags[nip22Root];
    relationships.push(tagRelationship('reply-root', 'event', tag[1], tag, nip22Root, 'NIP-22', 'known'));
  }
  event.tags.forEach((tag, index) => {
    if (tag[0] === 'q' && EVENT_ID.test(tag[1])) {
      relationships.push(tagRelationship('quoted-event', 'event', tag[1], tag, index, 'NIP-18', 'known'));
    } else if (['p', 'P'].includes(tag[0]) && EVENT_ID.test(tag[1])
      && !(event.kind === 3 && tag[0] !== 'p')) {
      relationships.push(tagRelationship(
        event.kind === 3 ? 'follow' : 'mentioned-account',
        'account', tag[1], tag, index,
        event.kind === 1111 ? 'NIP-22' : 'NIP-01', 'known',
      ));
    } else if (tag[0] === 't' && typeof tag[1] === 'string') {
      relationships.push(tagRelationship('topic', 'tag', tag[1], tag, index, 'NIP-01', 'known'));
    } else if (tag[0] === 'E' && EVENT_ID.test(tag[1]) && event.kind !== 1111) {
      relationships.push(tagRelationship(
        'mentioned-event', 'event', tag[1], tag, index,
        'NIP-01', 'best-effort-fallback',
      ));
    } else if (!['e', 'E', 'q', 'p', 'P', 't'].includes(tag[0]) && typeof tag[1] === 'string') {
      relationships.push(tagRelationship('other-tag', 'tag', `${tag[0]}:${tag[1]}`, tag, index, 'NIP-01', 'known'));
    }
  });
  return relationships;
}

const TRANSFORM_KINDS = new Set(SUBJECT_COLLECTION_KINDS);
const PIPELINE_FIELDS = Object.freeze({
  common: ['subject', 'subject.type', 'subject.id', 'evidence.resident', 'observedRelay'],
  events: [
    'event.author', 'event.kind', 'event.text', 'event.createdAt', 'event.tag',
    'event.linkedDomain', 'event.hasMedia',
  ],
  accounts: ['account.name', 'account.display_name', 'account.description'],
});

function validateRetainableCollectionKind(kind) {
  if (!TRANSFORM_KINDS.has(kind)) {
    throw new ResearchMemoryError(
      `Retention requires a subject collection; ${kind} collections contain no retainable subjects.`,
    );
  }
}
const GROUP_KEYS = new Set([
  'subject', 'event.author', 'event.kind', 'event.tag', 'event.linkedDomain', 'observedRelay',
]);
function normalizeTransformOperation(value, inputKind, itemKind, index) {
  assertPlainObject(value, `Transform stage ${index + 1}`);
  const operation = value.operation;
  if (![
    'filter', 'project', 'distinct', 'sort', 'limit', 'sample',
    'group', 'summarize', 'move', 'union', 'intersection', 'difference', 'compare',
  ].includes(operation)) {
    throw new ResearchMemoryError(`Unsupported transform operation at stage ${index + 1}: ${operation}.`);
  }
  if (value.as !== undefined && (typeof value.as !== 'string' || value.as.trim().length === 0)) {
    throw new ResearchMemoryError(`Transform stage ${index + 1} as must be a non-empty string.`);
  }
  const common = { operation, ...(value.as === undefined ? {} : { as: value.as.trim() }) };
  if (['union', 'intersection', 'difference', 'compare'].includes(operation)) {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'with', 'limit']), `${operation} stage`);
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`${operation} requires a subject collection.`);
    }
    assertResultCollection(value.with);
    const rightKind = value.with.kind ?? inferSubjectCollectionKind(value.with.items);
    if (rightKind !== inputKind) {
      throw new ResearchMemoryError(
        `Incompatible ${operation} collections: ${inputKind} and ${rightKind}.`,
      );
    }
    return {
      ...common, with: cloneJson(value.with), limit: normalizeTransformLimit(value.limit),
    };
  }
  if (operation === 'sort') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'by', 'direction']), 'sort stage');
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`Sort does not support ${inputKind} collections.`);
    }
    validateTransformField(value.by, itemKind, 'Sort');
    if (value.direction !== undefined && !['ascending', 'descending'].includes(value.direction)) {
      throw new ResearchMemoryError('Sort direction must be ascending or descending.');
    }
    return { ...common, by: value.by, direction: value.direction ?? 'ascending' };
  }
  if (operation === 'limit' || operation === 'sample') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'limit', 'seed']), `${operation} stage`);
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`${operation} does not support ${inputKind} collections.`);
    }
    if (operation === 'sample' && value.seed !== undefined
        && (typeof value.seed !== 'string' || value.seed.length === 0)) {
      throw new ResearchMemoryError('Sample seed must be a non-empty string.');
    }
    return {
      ...common, limit: normalizeTransformLimit(value.limit),
      ...(operation === 'sample' ? { seed: value.seed ?? 'nostr-research' } : {}),
    };
  }
  if (operation === 'project') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'fields', 'limit']), 'project stage');
    if (!Array.isArray(value.fields) || value.fields.length === 0) {
      throw new ResearchMemoryError('Project fields must be a non-empty array.');
    }
    const fields = value.fields.map((field) => {
      validateTransformField(field, itemKind, 'Project');
      return field;
    });
    if (new Set(fields).size !== fields.length) {
      throw new ResearchMemoryError('Project fields must be distinct.');
    }
    return { ...common, fields, limit: normalizeTransformLimit(value.limit) };
  }
  if (operation === 'distinct') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'by', 'limit']), 'distinct stage');
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`Distinct does not support ${inputKind} collections.`);
    }
    validateTransformField(value.by, itemKind, 'Distinct');
    return { ...common, by: value.by, limit: normalizeTransformLimit(value.limit) };
  }
  if (operation === 'filter') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'where', 'limit']), 'filter stage');
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`Filter does not support ${inputKind} collections.`);
    }
    const where = normalizePredicate(value.where);
    validatePredicateKind(where, itemKind);
    return { ...common, where, limit: normalizeTransformLimit(value.limit) };
  }
  if (operation === 'group') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'by', 'limit', 'itemLimit']), 'group stage');
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`Group does not support ${inputKind} collections.`);
    }
    if (!GROUP_KEYS.has(value.by)) throw new ResearchMemoryError(`Unsupported group key: ${value.by}.`);
    if (value.by.startsWith('event.') && inputKind !== 'events') {
      throw new ResearchMemoryError(`Group key ${value.by} requires an events collection.`);
    }
    return {
      ...common, by: value.by, limit: normalizeTransformLimit(value.limit),
      itemLimit: normalizeTransformLimit(value.itemLimit),
    };
  }
  if (operation === 'summarize') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'aggregations', 'limit']), 'summarize stage');
    if (!['groups', ...TRANSFORM_KINDS].includes(inputKind)) {
      throw new ResearchMemoryError(`Summarize does not support ${inputKind} collections.`);
    }
    if (!Array.isArray(value.aggregations) || value.aggregations.length === 0) {
      throw new ResearchMemoryError('Summarize aggregations must be a non-empty array.');
    }
    const aggregations = value.aggregations.map((item) => normalizeAggregation(item, itemKind));
    const names = new Set();
    for (const aggregation of aggregations) {
      if (names.has(aggregation.name)) {
        throw new ResearchMemoryError(`Duplicate summary aggregation name: ${aggregation.name}.`);
      }
      names.add(aggregation.name);
    }
    return {
      ...common,
      aggregations,
      limit: normalizeTransformLimit(value.limit),
    };
  }
  rejectUnknownKeys(value, new Set(['operation', 'as', 'to', 'limit']), 'move stage');
  const output = MOVE_ROUTES[`${inputKind}:${value.to}`];
  if (!output) {
    throw new ResearchMemoryError(`Move from ${inputKind} to ${value.to} is not supported.`);
  }
  return { ...common, to: value.to, limit: normalizeTransformLimit(value.limit) };
}

function normalizeTransformLimit(value) {
  if (value === undefined) return DEFAULT_TRANSFORM_LIMIT;
  return normalizeLimit(value);
}

function normalizePredicate(value) {
  assertPlainObject(value, 'Filter predicate');
  const composition = ['all', 'any', 'not'].filter((key) => key in value);
  if (composition.length) {
    if (composition.length !== 1 || Object.keys(value).length !== 1) {
      throw new ResearchMemoryError('A composed filter predicate must contain exactly one of all, any, or not.');
    }
    const key = composition[0];
    if (key === 'not') return { not: normalizePredicate(value.not) };
    if (!Array.isArray(value[key]) || value[key].length === 0) {
      throw new ResearchMemoryError(`Filter ${key} must be a non-empty array.`);
    }
    return { [key]: value[key].map(normalizePredicate) };
  }
  rejectUnknownKeys(
    value, new Set(['field', 'equals', 'in', 'contains', 'name', 'value']),
    'filter predicate',
  );
  const fields = new Set([
    'subject.type', 'subject.id', 'event.author', 'event.kind', 'event.text',
    'event.createdAt', 'event.tag', 'event.linkedDomain', 'event.hasMedia',
    'account.name', 'account.display_name', 'account.description', 'evidence.resident',
  ]);
  if (!fields.has(value.field)) throw new ResearchMemoryError(`Unsupported filter field: ${value.field}.`);
  const operators = ['equals', 'in', 'contains'].filter((key) => key in value);
  if (value.field === 'event.tag') {
    if (operators.length || typeof value.name !== 'string' || typeof value.value !== 'string') {
      throw new ResearchMemoryError('event.tag requires string name and value fields.');
    }
    return { field: value.field, name: value.name, value: value.value };
  }
  if (operators.length !== 1 || value.name !== undefined || value.value !== undefined) {
    throw new ResearchMemoryError('A filter predicate requires exactly one of equals, in, or contains.');
  }
  if (operators[0] === 'in' && (!Array.isArray(value.in) || value.in.length === 0)) {
    throw new ResearchMemoryError('Filter in must be a non-empty array.');
  }
  if (operators[0] === 'contains' && typeof value.contains !== 'string') {
    throw new ResearchMemoryError('Filter contains must be a string.');
  }
  const fieldType = ['event.kind', 'event.createdAt'].includes(value.field) ? 'number'
    : ['event.hasMedia', 'evidence.resident'].includes(value.field) ? 'boolean' : 'string';
  if (operators[0] === 'contains' && fieldType !== 'string') {
    throw new ResearchMemoryError(`Filter contains is not supported for ${value.field}.`);
  }
  const operands = operators[0] === 'in' ? value.in : [value[operators[0]]];
  if (operands.some((operand) => typeof operand !== fieldType)) {
    throw new ResearchMemoryError(`Filter ${value.field} values must be ${fieldType}s.`);
  }
  return cloneJson(value);
}

function validatePredicateKind(predicate, itemKind) {
  if (predicate.all) return predicate.all.forEach((part) => validatePredicateKind(part, itemKind));
  if (predicate.any) return predicate.any.forEach((part) => validatePredicateKind(part, itemKind));
  if (predicate.not) return validatePredicateKind(predicate.not, itemKind);
  if (predicate.field.startsWith('event.') && itemKind !== 'events') {
    throw new ResearchMemoryError(`Filter field ${predicate.field} requires an events collection.`);
  }
  if (predicate.field.startsWith('account.') && itemKind !== 'accounts') {
    throw new ResearchMemoryError(`Filter field ${predicate.field} requires an accounts collection.`);
  }
}

function validateTransformField(field, itemKind, label) {
  if (typeof field !== 'string'
      || !Object.values(PIPELINE_FIELDS).some((fields) => fields.includes(field))) {
    throw new ResearchMemoryError(`Unsupported ${label.toLocaleLowerCase()} field: ${field}.`);
  }
  if (field.startsWith('event.') && itemKind !== 'events') {
    throw new ResearchMemoryError(`${label} field ${field} requires an events collection.`);
  }
  if (field.startsWith('account.') && itemKind !== 'accounts') {
    throw new ResearchMemoryError(`${label} field ${field} requires an accounts collection.`);
  }
}

function normalizeAggregation(value, itemKind) {
  assertPlainObject(value, 'Summary aggregation');
  rejectUnknownKeys(value, new Set(['name', 'operation', 'field', 'limit']), 'summary aggregation');
  if (typeof value.name !== 'string' || value.name.trim().length === 0) {
    throw new ResearchMemoryError('Summary aggregation name must be a non-empty string.');
  }
  if (!['count', 'distinct', 'sample', 'collect', 'min', 'max'].includes(value.operation)) {
    throw new ResearchMemoryError(`Unsupported summary aggregation: ${value.operation}.`);
  }
  if (value.operation === 'count' && value.field !== undefined) {
    throw new ResearchMemoryError('count aggregation does not accept a field.');
  }
  if (value.operation !== 'count' && typeof value.field !== 'string') {
    throw new ResearchMemoryError(`${value.operation} aggregation requires a field.`);
  }
  if (!['sample', 'collect'].includes(value.operation) && value.limit !== undefined) {
    throw new ResearchMemoryError(`${value.operation} aggregation does not accept a limit.`);
  }
  const fields = new Set([
    'subject', 'subject.id', 'event.author', 'event.kind', 'event.text',
    'event.createdAt', 'event.linkedDomain', 'observedRelay',
  ]);
  if (value.operation !== 'count' && !fields.has(value.field)) {
    throw new ResearchMemoryError(`Unsupported summary field: ${value.field}.`);
  }
  if (value.field?.startsWith('event.') && itemKind !== 'events') {
    throw new ResearchMemoryError(
      `Summary field ${value.field} requires an events collection or event groups.`,
    );
  }
  return {
    name: value.name.trim(), operation: value.operation, field: value.field,
    ...(['sample', 'collect'].includes(value.operation)
      ? { limit: normalizeTransformLimit(value.limit) } : {}),
  };
}

function applyTransform(memory, collection, operation) {
  let output;
  if (operation.operation === 'filter') output = applyFilter(memory, collection, operation);
  else if (operation.operation === 'project') output = applyProject(memory, collection, operation);
  else if (operation.operation === 'distinct') output = applyDistinct(memory, collection, operation);
  else if (operation.operation === 'sort') output = applySort(memory, collection, operation);
  else if (operation.operation === 'limit') output = boundedSubjectCollection(collection, operation.limit);
  else if (operation.operation === 'sample') output = applySample(collection, operation);
  else if (operation.operation === 'group') output = applyGroup(collection, operation);
  else if (operation.operation === 'summarize') output = applySummary(collection, operation);
  else if (operation.operation === 'move') output = applyMove(memory, collection, operation);
  else output = applySetOperation(collection, operation);
  output.bounds ??= cardinalityMetadata(collection.items.length, output.items.length);
  output.context = transformContext(collection, operation);
  output.context.cardinality = cloneJson(output.bounds);
  return output;
}

function transformContext(input, operation) {
  const previous = input.context?.stages ?? [];
  const publicOperation = 'with' in operation
    ? {
        ...operation,
        with: {
          type: 'collection-reference',
          kind: operation.with.kind,
          count: operation.with.items.length,
        },
      }
    : operation;
  return {
    operation: 'transform',
    input: cloneJson(input.context),
    stages: [...cloneJson(previous), cloneJson(publicOperation)],
    ...(operation.as ? { name: operation.as } : {}),
  };
}

function applyFilter(memory, collection, operation) {
  const items = collection.items.filter((item) => matchesPredicate(memory, item, operation.where))
    .slice(0, operation.limit);
  const { kind } = transformOutputKind(
    collection.kind, collection.itemKind ?? collection.kind, operation,
  );
  return resultCollection(items, {}, kind);
}

function applyProject(memory, collection, operation) {
  const items = collection.items.slice(0, operation.limit).map((item) => ({
    subject: item.subject,
    role: item.role,
    values: Object.fromEntries(operation.fields.map((field) => [
      field, cloneJson(transformField(memory, item, field) ?? null),
    ])),
    reasons: cloneJson(item.reasons),
    provenance: cloneJson(item.provenance),
  }));
  return typedCollection('projections', items, {}, collection.itemKind ?? collection.kind);
}

function applyDistinct(memory, collection, operation) {
  const found = new Map();
  for (const item of collection.items) {
    const value = transformField(memory, item, operation.by);
    const key = stableJson(value ?? null);
    if (!found.has(key)) {
      found.set(key, {
        value: cloneJson(value ?? null), items: [], reasons: [], provenance: [],
      });
    }
    const entry = found.get(key);
    entry.items.push(item);
    mergeUniqueJson(entry.reasons, item.reasons);
    mergeUniqueJson(entry.provenance, item.provenance);
  }
  const items = [...found.entries()].sort(([left], [right]) => left.localeCompare(right))
    .slice(0, operation.limit).map(([, entry]) => ({
      subject: entry.items[0].subject,
      values: { [operation.by]: entry.value },
      subjects: entry.items.map(({ subject: item }) => cloneJson(item)),
      memberCount: entry.items.length,
      reasons: entry.reasons,
      provenance: entry.provenance,
    }));
  return typedCollection('projections', items, {}, collection.itemKind ?? collection.kind);
}

function applySort(memory, collection, operation) {
  const items = collection.items.map((item, index) => ({
    item, index, value: transformField(memory, item, operation.by),
  }));
  items.sort((left, right) => {
    const order = comparePipelineValues(left.value, right.value);
    return (operation.direction === 'descending' ? -order : order) || left.index - right.index;
  });
  return resultCollection(items.map(({ item }) => item), {}, collection.kind);
}

function boundedSubjectCollection(collection, limit) {
  return resultCollection(collection.items.slice(0, limit), {}, collection.kind);
}

function applySample(collection, operation) {
  const ranked = collection.items.map((item, index) => ({
    item, index,
    rank: stableHash(`${operation.seed}\u0000${memberKey(item.subject)}`),
  })).sort((left, right) => left.rank - right.rank || left.index - right.index);
  return resultCollection(ranked.slice(0, operation.limit).map(({ item }) => item),
    {}, collection.kind);
}

function applySetOperation(collection, operation) {
  const left = new Map(collection.items.map((item) => [memberKey(item.subject), item]));
  const right = new Map(operation.with.items.map((item) => [memberKey(item.subject), item]));
  const keys = operation.operation === 'union'
    ? [...new Set([...left.keys(), ...right.keys()])]
    : operation.operation === 'intersection'
      ? [...left.keys()].filter((key) => right.has(key))
      : operation.operation === 'difference'
        ? [...left.keys()].filter((key) => !right.has(key))
        : [];
  if (operation.operation === 'compare') {
    const shared = [...left.keys()].filter((key) => right.has(key)).length;
    const output = typedCollection('summaries', [{
      key: null,
      values: {
        left: left.size, right: right.size, shared,
        leftOnly: left.size - shared, rightOnly: right.size - shared,
      },
      reasons: uniqueJson([...left.values(), ...right.values()].flatMap((item) => item.reasons)),
      provenance: uniqueJson(
        [...left.values(), ...right.values()].flatMap((item) => item.provenance),
      ),
    }], {}, 'summaries');
    output.bounds = {
      leftCount: left.size, rightCount: right.size, outputCount: 1,
      omittedCount: 0, truncated: false,
    };
    return output;
  }
  const items = keys.sort().slice(0, operation.limit).map((key) => {
    const first = left.get(key);
    const second = right.get(key);
    return {
      ...(first ?? second),
      reasons: uniqueJson([...(first?.reasons ?? []), ...(second?.reasons ?? [])]),
      provenance: uniqueJson([...(first?.provenance ?? []), ...(second?.provenance ?? [])]),
    };
  });
  const output = resultCollection(items, {}, collection.kind);
  output.bounds = cardinalityMetadata(keys.length, items.length);
  output.bounds.leftCount = left.size;
  output.bounds.rightCount = right.size;
  return output;
}

function matchesPredicate(memory, item, predicate) {
  if (predicate.all) return predicate.all.every((part) => matchesPredicate(memory, item, part));
  if (predicate.any) return predicate.any.some((part) => matchesPredicate(memory, item, part));
  if (predicate.not) return !matchesPredicate(memory, item, predicate.not);
  if (predicate.field === 'event.tag') {
    return (item.record?.event?.tags ?? []).some(
      (tag) => tag[0] === predicate.name && tag[1] === predicate.value,
    );
  }
  if (predicate.field === 'event.linkedDomain') {
    const domains = linkedDomains(item.record?.event?.content ?? '');
    if ('equals' in predicate) return domains.includes(predicate.equals);
    if ('in' in predicate) return domains.some((domain) => predicate.in.includes(domain));
    return domains.some((domain) => (
      domain.toLocaleLowerCase().includes(predicate.contains.toLocaleLowerCase())
    ));
  }
  const actual = transformField(memory, item, predicate.field);
  if ('equals' in predicate) return actual === predicate.equals;
  if ('in' in predicate) return predicate.in.includes(actual);
  return typeof actual === 'string'
    && actual.toLocaleLowerCase().includes(predicate.contains.toLocaleLowerCase());
}

function transformField(memory, item, field) {
  const event = item.record?.event;
  const profile = item.record?.profile;
  if (field === 'subject') return item.subject;
  if (field === 'subject.type') return item.subject?.type;
  if (field === 'subject.id') return item.subject?.id;
  if (field === 'event.author') return event?.pubkey;
  if (field === 'event.kind') return event?.kind;
  if (field === 'event.text') return event?.content;
  if (field === 'event.tag') return (event?.tags ?? [])
    .filter((tag) => tag.length > 1)
    .map((tag) => ({ name: tag[0], value: tag[1] }));
  if (field === 'event.linkedDomain') return linkedDomains(event?.content ?? '')[0];
  if (field === 'event.hasMedia') return hasMedia(event?.content ?? '');
  if (field === 'account.name') return profile?.name;
  if (field === 'account.display_name') return profile?.display_name;
  if (field === 'account.description') return profile?.about;
  if (field === 'evidence.resident') return item.subject
    ? memory.inspect(item.subject).resident : false;
  if (field === 'group.key') return item.key;
  if (field === 'event.createdAt') return event?.created_at;
  if (field === 'observedRelay') return item.provenance?.[0]?.relay;
  throw new ResearchMemoryError(`Unsupported transform field: ${field}.`);
}

function applyGroup(collection, operation) {
  const groups = new Map();
  for (const item of collection.items) {
    for (const key of groupKeys(item, operation.by)) {
      const encoded = stableJson(key);
      if (!groups.has(encoded)) {
        groups.set(encoded, {
          key: cloneJson(key), items: [], memberCount: 0,
          aggregationInputs: Object.fromEntries(
            SUMMARY_FIELDS.map((field) => [field, []]),
          ),
          reasons: [],
          provenance: [],
        });
      }
      const group = groups.get(encoded);
      group.memberCount += 1;
      for (const field of SUMMARY_FIELDS) {
        group.aggregationInputs[field].push(...aggregationValues([item], field));
      }
      mergeUniqueJson(group.reasons, item.reasons);
      mergeUniqueJson(group.provenance, item.provenance);
      if (group.items.length < operation.itemLimit) {
        group.items.push(cloneJson(item));
      }
    }
  }
  const items = [...groups.values()]
    .sort((left, right) => stableJson(left.key).localeCompare(stableJson(right.key)))
    .slice(0, operation.limit)
    .map((group) => ({
      ...group,
      retainedMemberCount: group.items.length,
      omittedMemberCount: group.memberCount - group.items.length,
      truncated: group.memberCount > group.items.length,
      reasons: group.reasons,
      provenance: group.provenance,
    }));
  const output = typedCollection('groups', items, {}, collection.itemKind ?? collection.kind);
  output.bounds = cardinalityMetadata(groups.size, items.length);
  output.bounds.sourceItemCount = collection.items.length;
  return output;
}

function groupKeys(item, by) {
  if (by === 'subject') return [item.subject];
  if (by === 'event.author') return [item.record.event.pubkey];
  if (by === 'event.kind') return [item.record.event.kind];
  if (by === 'event.tag') return item.record.event.tags
    .filter((tag) => tag.length > 1).map((tag) => ({ name: tag[0], value: tag[1] }));
  if (by === 'event.linkedDomain') return linkedDomains(item.record.event.content);
  return [...new Set(item.provenance.map(({ relay }) => relay).filter(Boolean))].sort();
}

function applySummary(collection, operation) {
  const sources = collection.kind === 'groups'
    ? collection.items.map((group) => ({ key: group.key, values: group.items,
      memberCount: group.memberCount, aggregationInputs: group.aggregationInputs,
      reasons: group.reasons, provenance: group.provenance }))
    : [{ key: null, values: collection.items,
      reasons: uniqueJson(collection.items.flatMap((item) => item.reasons)),
      provenance: uniqueJson(collection.items.flatMap((item) => item.provenance)) }];
  const items = sources.slice(0, operation.limit).map((source) => ({
    key: cloneJson(source.key),
    values: Object.fromEntries(operation.aggregations.map((aggregation) => [
      aggregation.name, aggregate(source, aggregation),
    ])),
    omissions: Object.fromEntries(operation.aggregations.map((aggregation) => [
      aggregation.name, aggregationOmissions(source, aggregation),
    ])),
    reasons: cloneJson(source.reasons),
    provenance: cloneJson(source.provenance),
  }));
  const output = typedCollection('summaries', items, {}, 'summaries');
  output.bounds = cardinalityMetadata(sources.length, items.length);
  return output;
}

function aggregate(source, aggregation) {
  if (aggregation.operation === 'count') return source.memberCount ?? source.values.length;
  const values = source.aggregationInputs?.[aggregation.field]
    ?? aggregationValues(source.values, aggregation.field);
  if (aggregation.operation === 'distinct') return uniqueJson(values).length;
  if (aggregation.operation === 'sample') return cloneJson(values.slice(0, aggregation.limit));
  if (aggregation.operation === 'collect') return cloneJson(values.slice(0, aggregation.limit));
  if (values.length === 0) return null;
  return aggregation.operation === 'min'
    ? values.reduce((best, value) => value < best ? value : best)
    : values.reduce((best, value) => value > best ? value : best);
}

function aggregationOmissions(source, aggregation) {
  const sourceItemsOmitted = Math.max(
    0, (source.memberCount ?? source.values.length) - source.values.length,
  );
  if (aggregation.operation === 'count') {
    return {
      availableCount: source.memberCount ?? source.values.length,
      retainedCount: source.memberCount ?? source.values.length,
      omittedCount: 0,
      sourceItemsOmitted,
      inputComplete: true,
      truncated: false,
    };
  }
  const available = (source.aggregationInputs?.[aggregation.field]
    ?? aggregationValues(source.values, aggregation.field)).length;
  const retained = ['sample', 'collect'].includes(aggregation.operation)
    ? Math.min(available, aggregation.limit) : available;
  return {
    availableCount: available,
    retainedCount: retained,
    omittedCount: Math.max(0, available - retained),
    sourceItemsOmitted,
    inputComplete: source.aggregationInputs !== undefined || sourceItemsOmitted === 0,
    truncated: available > retained,
  };
}

function aggregationValues(items, field) {
  return items.map((item) => summaryField(item, field))
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null);
}

function summaryField(item, field) {
  if (field === 'subject') return item.subject;
  if (field === 'subject.id') return item.subject?.id;
  if (field === 'event.author') return item.record?.event?.pubkey;
  if (field === 'event.kind') return item.record?.event?.kind;
  if (field === 'event.text') return item.record?.event?.content;
  if (field === 'event.createdAt') return item.record?.event?.created_at;
  if (field === 'event.linkedDomain') return linkedDomains(item.record?.event?.content ?? '');
  if (field === 'observedRelay') return item.provenance?.map(({ relay }) => relay).filter(Boolean);
  throw new ResearchMemoryError(`Unsupported summary field: ${field}.`);
}

const SUMMARY_FIELDS = Object.freeze([
  'subject', 'subject.id', 'event.author', 'event.kind', 'event.text',
  'event.createdAt', 'event.linkedDomain', 'observedRelay',
]);

function applyMove(memory, collection, operation) {
  const merged = new Map();
  const add = (candidate, source, transition) => {
    const key = memberKey(candidate.subject);
    const found = merged.get(key) ?? { ...candidate, reasons: [], provenance: [] };
    mergeUniqueJson(found.reasons, source.reasons);
    mergeUniqueJson(found.reasons, [{ type: 'collection-move', transition, source: source.subject }]);
    mergeUniqueJson(found.provenance, source.provenance);
    mergeUniqueJson(found.provenance, candidate.provenance);
    merged.set(key, found);
  };
  for (const item of collection.items) {
    if (operation.to === 'authors') {
      add(memory.lookup(subject('account', item.record.event.pubkey)).items[0], item, 'event-author');
    } else if (operation.to === 'referencedAccounts' || operation.to === 'referencedEvents') {
      const wanted = operation.to === 'referencedAccounts' ? 'account' : 'event';
      for (const relationship of eventRelationships(item.record.event)) {
        if (relationship.type === 'author' || relationship.targetType !== wanted) continue;
        add(memory.lookup(subject(wanted, relationship.targetId)).items[0], item,
          `event-${operation.to}`);
      }
    } else if (operation.to === 'authoredEvents') {
      for (const candidate of memory.select({
        authors: [item.subject.id], limit: MAX_QUERY_LIMIT, order: 'oldest',
      }).items) add(candidate, item, 'account-authored-event');
    } else {
      for (const candidate of memory.follows(item.subject).items) {
        add(candidate, item, 'account-followed-account');
      }
    }
  }
  const items = [...merged.values()]
    .sort((left, right) => memberKey(left.subject).localeCompare(memberKey(right.subject)))
    .slice(0, operation.limit);
  return resultCollection(items, {}, MOVE_ROUTES[`${collection.kind}:${operation.to}`]);
}

function typedCollection(kind, items, context, itemKind = kind) {
  return {
    type: 'typed-collection', kind, itemKind,
    items: cloneJson(items), context: cloneJson(context),
  };
}

function cardinalityMetadata(inputCount, outputCount) {
  return {
    inputCount,
    outputCount,
    omittedCount: Math.max(0, inputCount - outputCount),
    truncated: outputCount < inputCount,
  };
}

function comparePipelineValues(left, right) {
  if (left === right) return 0;
  if (left === undefined || left === null) return 1;
  if (right === undefined || right === null) return -1;
  if (typeof left === typeof right && ['number', 'string', 'boolean'].includes(typeof left)) {
    return left < right ? -1 : 1;
  }
  return stableJson(left).localeCompare(stableJson(right));
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function collectionPipelineSchema() {
  const valueFields = {
    subjects: [...PIPELINE_FIELDS.common],
    events: [...PIPELINE_FIELDS.common, ...PIPELINE_FIELDS.events],
    accounts: [...PIPELINE_FIELDS.common, ...PIPELINE_FIELDS.accounts],
    relationships: [...PIPELINE_FIELDS.common],
  };
  const filterFields = {
    subjects: {
      'subject.type': stringPredicateSchema(),
      'subject.id': stringPredicateSchema(),
      'evidence.resident': scalarPredicateSchema('boolean'),
    },
    events: {
      'subject.type': stringPredicateSchema(),
      'subject.id': stringPredicateSchema(),
      'evidence.resident': scalarPredicateSchema('boolean'),
      'event.author': stringPredicateSchema(),
      'event.kind': scalarPredicateSchema('number'),
      'event.text': stringPredicateSchema(),
      'event.createdAt': scalarPredicateSchema('number'),
      'event.tag': {
        valueType: 'tag[]',
        predicate: { field: 'event.tag', name: 'string', value: 'string' },
      },
      'event.linkedDomain': stringPredicateSchema(),
      'event.hasMedia': scalarPredicateSchema('boolean'),
    },
    accounts: {
      'subject.type': stringPredicateSchema(),
      'subject.id': stringPredicateSchema(),
      'evidence.resident': scalarPredicateSchema('boolean'),
      'account.name': stringPredicateSchema(),
      'account.display_name': stringPredicateSchema(),
      'account.description': stringPredicateSchema(),
    },
    relationships: {
      'subject.type': stringPredicateSchema(),
      'subject.id': stringPredicateSchema(),
      'evidence.resident': scalarPredicateSchema('boolean'),
    },
  };
  const groupFields = {
    subjects: ['subject', 'observedRelay'],
    events: [...GROUP_KEYS],
    accounts: ['subject', 'observedRelay'],
    relationships: ['subject', 'observedRelay'],
  };
  const summaryFields = {
    subjects: ['subject', 'subject.id', 'observedRelay'],
    events: [...SUMMARY_FIELDS],
    accounts: ['subject', 'subject.id', 'observedRelay'],
    relationships: ['subject', 'subject.id', 'observedRelay'],
  };
  return cloneJson({
    type: 'collection-pipeline-schema',
    version: 1,
    research: operationSchema(),
    fields: {
      purpose: 'value fields accepted by project, distinct, and sort',
      ...PIPELINE_FIELDS,
      byInputKind: valueFields,
      valueTypes: {
        subject: 'subject',
        'subject.type': 'string',
        'subject.id': 'string',
        'evidence.resident': 'boolean',
        observedRelay: 'string',
        'event.author': 'string',
        'event.kind': 'number',
        'event.text': 'string',
        'event.createdAt': 'number',
        'event.tag': 'tag[]',
        'event.linkedDomain': 'string',
        'event.hasMedia': 'boolean',
        'account.name': 'string',
        'account.display_name': 'string',
        'account.description': 'string',
      },
    },
    operations: {
      filter: {
        inputKinds: [...TRANSFORM_KINDS],
        fieldsByInputKind: filterFields,
        where: {
          composition: {
            all: 'non-empty predicate[]',
            any: 'non-empty predicate[]',
            not: 'predicate',
          },
          rule: 'exactly one composition or one field predicate',
        },
        limit: 'bound',
      },
      project: { fieldsByInputKind: valueFields, fields: 'non-empty distinct field[]', limit: 'bound' },
      distinct: { fieldsByInputKind: valueFields, by: 'field', limit: 'bound' },
      sort: {
        fieldsByInputKind: valueFields,
        by: 'field',
        direction: ['ascending', 'descending'],
      },
      limit: { limit: 'bound' },
      sample: { limit: 'bound', seed: 'string' },
      group: { fieldsByInputKind: groupFields, by: 'field', limit: 'bound', itemLimit: 'bound' },
      summarize: {
        fieldsByInputKind: summaryFields,
        fieldTypes: {
          subject: 'subject',
          'subject.id': 'string',
          'event.author': 'string',
          'event.kind': 'number',
          'event.text': 'string',
          'event.createdAt': 'number',
          'event.linkedDomain': 'string',
          observedRelay: 'string',
        },
        aggregations: {
          count: { field: 'forbidden', resultType: 'number' },
          distinct: { field: 'summary field', resultType: 'number' },
          sample: { field: 'summary field', limit: 'bound', resultType: 'value[]' },
          collect: { field: 'summary field', limit: 'bound', resultType: 'value[]' },
          min: { field: 'summary field', resultType: 'field value' },
          max: { field: 'summary field', resultType: 'field value' },
        },
        aggregationShape: {
          name: 'non-empty string',
          operation: ['count', 'distinct', 'sample', 'collect', 'min', 'max'],
        },
        limit: 'bound',
      },
      move: { routes: cloneJson(MOVE_ROUTES), limit: 'bound' },
      set: {
        operations: ['union', 'intersection', 'difference', 'compare'],
        inputKinds: [...TRANSFORM_KINDS],
        with: 'result-collection of the same kind',
        limit: 'bound',
      },
    },
    bounds: { minimum: 1, maximum: MAX_QUERY_LIMIT, default: DEFAULT_TRANSFORM_LIMIT },
    ordering: {
      sort: 'stable; null and absent values follow present values',
      sample: 'stable subject identity ranked by deterministic seed hash',
      set: 'stable subject identity order',
    },
  });
}

function scalarPredicateSchema(valueType) {
  return {
    valueType,
    comparisons: {
      equals: valueType,
      in: `non-empty ${valueType}[]`,
    },
  };
}

function stringPredicateSchema() {
  const schema = scalarPredicateSchema('string');
  schema.comparisons.contains = 'string';
  return schema;
}

function linkedDomains(text) {
  const domains = [];
  for (const match of text.matchAll(/https?:\/\/([^/\s?#]+)/giu)) {
    try {
      domains.push(new URL(match[0]).hostname.toLocaleLowerCase());
    } catch {
      // Ignore malformed URL-shaped text.
    }
  }
  return [...new Set(domains)].sort();
}

function hasMedia(text) {
  return /https?:\/\/\S+\.(?:avif|gif|jpe?g|png|webp|mp3|mp4|m4a|ogg|wav)(?:[?#]\S*)?/iu.test(text)
    || /https?:\/\/(?:blossom\.|image\.nostr\.build)/iu.test(text);
}

function uniqueJson(values) {
  const found = new Map();
  for (const value of values) found.set(stableJson(value), cloneJson(value));
  return [...found.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function tagRelationship(type, targetType, targetId, tag, tagIndex, protocol, interpretation) {
  return {
    type,
    targetType,
    targetId,
    evidence: { interpretation, protocol, tag, tagIndex },
  };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ResearchMemoryError(`${label} must be an object.`);
  }
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ResearchMemoryError(`Unknown ${label} field: ${key}.`);
  }
}

function normalizeSetName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ResearchMemoryError('Research set name must be a non-empty string.');
  }
  return name.trim();
}

function normalizeMember(member) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) {
    throw new ResearchMemoryError('Research set member must be an object.');
  }
  if (!RETAINABLE_SUBJECT_TYPES.has(member.type)) {
    throw new ResearchMemoryError('Research set member has an unsupported subject type.');
  }
  if (typeof member.id !== 'string' || member.id.length === 0
      || (['event', 'account'].includes(member.type) && !EVENT_ID.test(member.id))) {
    throw new ResearchMemoryError(
      'Research set member ID must be stable; event and account IDs must be full 64-character lowercase hexadecimal values.',
    );
  }
  return { type: member.type, id: member.id };
}

function normalizeReason(reason) {
  assertPlainObject(reason, 'Membership reason');
  if (typeof reason.type !== 'string' || reason.type.trim().length === 0) {
    throw new ResearchMemoryError('Membership reason type must be a non-empty string.');
  }
  return cloneJson(reason);
}

function normalizeAnnotation(value) {
  assertPlainObject(value, 'Annotation');
  rejectUnknownKeys(
    value,
    new Set(['labels', 'note', 'judgment', 'strength', 'reason']),
    'annotation',
  );
  const labels = value.labels === undefined ? [] : normalizeStringList(value.labels, 'labels', false);
  const uniqueLabels = [...new Set((labels ?? []).map((label) => label.trim()))].sort();
  if (uniqueLabels.some((label) => label.length === 0)) {
    throw new ResearchMemoryError('Annotation labels must be non-empty strings.');
  }
  const note = value.note ?? '';
  if (typeof note !== 'string') throw new ResearchMemoryError('Annotation note must be a string.');
  const judgment = value.judgment;
  if (judgment !== undefined
      && !['interested', 'uninterested', 'uncertain', 'anchor'].includes(judgment)) {
    throw new ResearchMemoryError(
      'Annotation judgment must be interested, uninterested, uncertain, or anchor.',
    );
  }
  const strength = value.strength;
  if (strength !== undefined
      && (typeof strength !== 'number' || !Number.isFinite(strength)
        || strength < 0 || strength > 1)) {
    throw new ResearchMemoryError('Annotation strength must be a number from 0 to 1.');
  }
  const reason = value.reason ?? '';
  if (typeof reason !== 'string') throw new ResearchMemoryError('Annotation reason must be a string.');
  if (uniqueLabels.length === 0 && note.trim().length === 0 && judgment === undefined) {
    throw new ResearchMemoryError(
      'An annotation requires at least one label, a note, or an explicit judgment.',
    );
  }
  return {
    labels: uniqueLabels,
    note,
    ...(judgment === undefined ? {} : { judgment }),
    ...(strength === undefined ? {} : { strength }),
    ...(reason.trim().length === 0 ? {} : { reason }),
  };
}

function normalizeAnnotationQuery(query) {
  assertPlainObject(query, 'Annotation query');
  rejectUnknownKeys(query, new Set(['labels', 'judgments', 'limit']), 'annotation query');
  const labels = query.labels === undefined ? [] : normalizeStringList(
    query.labels, 'labels', false,
  );
  const judgments = query.judgments === undefined ? [] : normalizeStringList(
    query.judgments, 'judgments', false,
  );
  if (judgments.some(
    (judgment) => !['interested', 'uninterested', 'uncertain', 'anchor'].includes(judgment),
  )) {
    throw new ResearchMemoryError(
      'Annotation judgments must be interested, uninterested, uncertain, or anchor.',
    );
  }
  return {
    labels: [...new Set((labels ?? []).map((label) => label.trim()))].sort(),
    judgments: [...new Set(judgments ?? [])].sort(),
    limit: normalizeLimit(query.limit),
  };
}

function retainedProvenance(item) {
  if (item.subject.type === 'event' && item.provenance.length > 0) {
    return [{ type: 'stored-event-observations', eventId: item.subject.id }];
  }
  const metadataEventId = item.record?.metadataEvent?.id;
  if (item.subject.type === 'account' && metadataEventId && item.provenance.length > 0) {
    return [{ type: 'stored-event-observations', eventId: metadataEventId }];
  }
  return item.provenance;
}

function memberKey(member) {
  return `${member.type}:${member.id}`;
}

function cloneJson(value) {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError('undefined');
    return JSON.parse(encoded);
  } catch {
    throw new ResearchMemoryError('Research records must contain JSON-serializable public data.');
  }
}

function mergeUniqueJson(target, additions) {
  for (const addition of additions ?? []) {
    if (!target.some((item) => stableJson(item) === stableJson(addition))) {
      target.push(cloneJson(addition));
    }
  }
}

function isPublicResearchSet(value) {
  return value && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.createdAt === 'string';
}

function stableJson(value) {
  return JSON.stringify(sortJson(cloneJson(value)));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortJson(value[key])]),
    );
  }
  return value;
}

export {
  acquireRelayEvents,
  hydrateAccounts,
  DEFAULT_ACQUISITION_OBSERVATION_LIMIT,
  DEFAULT_ACQUISITION_DISTINCT_EVENT_LIMIT,
  DEFAULT_ACQUISITION_TIMEOUT_MS,
  DEFAULT_RELAY_CONCURRENCY,
} from './acquire.js';
export { continueResearch } from './continuation.js';
export { executeResearchPlan } from './plan.js';
export {
  createDeclarativeResearchSession,
  DeclarativeResearchSession,
} from './interpreter.js';
