import { SUBJECT_COLLECTION_KINDS } from './operations.js';
import { RESEARCH_CONSTRAINTS } from './configuration.js';
import { NOTEBOOK_JUDGMENTS, QUERY_LIMIT } from './contract-facts.js';
import {
  collectionPipelineSchema as engineCollectionPipelineSchema,
  executeCollectionOperation,
  validateCollectionOperation,
} from './collection.js';
import {
  InvalidNostrEventError,
  ResearchMemoryError,
  isCanonicalNostrEvent,
  parseAddress,
  subject,
} from './protocol.js';
import { decodeNostrReference } from './reference.js';
import {
  NAVIGATION_RELATIONSHIP_TYPES,
  deriveEventRelationships,
} from './protocol-relationships.js';

const EVENT_ID = /^[a-f0-9]{64}$/;
const HEX_PREFIX = /^[a-f0-9]{4,64}$/;
const DEFAULT_QUERY_LIMIT = QUERY_LIMIT.default;
const MAX_QUERY_LIMIT = QUERY_LIMIT.maximum;
const MEMORY_CAPACITY = RESEARCH_CONSTRAINTS.memory.capacity;
const NOTEBOOK_CAPACITY = RESEARCH_CONSTRAINTS.notebook.capacity;
const SUBJECT_TYPES = new Set(['event', 'account', 'address', 'tag']);
const NOTEBOOK_SUBJECT_TYPES = new Set(['event', 'account', 'address', 'tag']);
const NAVIGATION_RELATIONSHIP_TYPE_SET = new Set(NAVIGATION_RELATIONSHIP_TYPES);
const MEMORY_TRANSACTION = Symbol.for('nostr-research.memory-plan-attempt');

/** Creates the authoritative bounded, process-local research memory. */
export function createInMemoryResearchMemory(options = {}) {
  assertPlainObject(options, 'In-memory research memory options');
  rejectUnknownKeys(
    options,
    new Set(['capacity', 'archiveCapacity', 'notebookCapacity']),
    'in-memory research memory option',
  );
  const capacity = options.capacity;
  if (!Number.isSafeInteger(capacity)
      || capacity < MEMORY_CAPACITY.minimum || capacity > MEMORY_CAPACITY.maximum) {
    throw new ResearchMemoryError(
      `In-memory research memory capacity must be an integer from `
      + `${MEMORY_CAPACITY.minimum} to ${MEMORY_CAPACITY.maximum}.`,
    );
  }
  const archiveCapacity = options.archiveCapacity ?? capacity;
  if (!Number.isSafeInteger(archiveCapacity)
      || archiveCapacity < MEMORY_CAPACITY.minimum
      || archiveCapacity > MEMORY_CAPACITY.maximum) {
    throw new ResearchMemoryError(
      `Evidence archive capacity must be an integer from `
      + `${MEMORY_CAPACITY.minimum} to ${MEMORY_CAPACITY.maximum}.`,
    );
  }
  const notebookCapacity = options.notebookCapacity ?? NOTEBOOK_CAPACITY.default;
  if (!Number.isSafeInteger(notebookCapacity)
      || notebookCapacity < NOTEBOOK_CAPACITY.minimum
      || notebookCapacity > NOTEBOOK_CAPACITY.maximum) {
    throw new ResearchMemoryError(
      `Research notebook capacity must be an integer from `
      + `${NOTEBOOK_CAPACITY.minimum} to ${NOTEBOOK_CAPACITY.maximum}.`,
    );
  }
  return new InMemoryResearchMemory(capacity, archiveCapacity, notebookCapacity);
}

/** The private indexed owner for canonical records and every derived index. */
class IndexedObservationBuffer {
  records = new Map();
  authors = new Map();
  kinds = new Map();
  tags = new Map();
  outbound = new Map();
  inbound = new Map();

  insert(record) {
    const stored = cloneJson(record);
    const { event } = stored;
    const relationships = deriveEventRelationships(event);
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

/** The single authoritative bounded process-local research memory. */
export class InMemoryResearchMemory {
  #capacity;
  #archiveCapacity;
  #notebookCapacity;
  #closed = false;
  #buffer = new IndexedObservationBuffer();
  #archive = new Map();
  #archivedCanonical = new IndexedObservationBuffer();
  #nextObservationId = 1;
  #evictions = 0;
  #notebookMemberships = new Map();
  #notebookEntries = new Map();

  constructor(
    capacity,
    archiveCapacity = capacity,
    notebookCapacity = NOTEBOOK_CAPACITY.default,
  ) {
    if (!Number.isSafeInteger(capacity)
        || capacity < MEMORY_CAPACITY.minimum || capacity > MEMORY_CAPACITY.maximum) {
      throw new ResearchMemoryError(
        `In-memory research memory capacity must be an integer from `
        + `${MEMORY_CAPACITY.minimum} to ${MEMORY_CAPACITY.maximum}.`,
      );
    }
    this.#capacity = capacity;
    if (!Number.isSafeInteger(archiveCapacity)
        || archiveCapacity < MEMORY_CAPACITY.minimum
        || archiveCapacity > MEMORY_CAPACITY.maximum) {
      throw new ResearchMemoryError(
        `Evidence archive capacity must be an integer from `
        + `${MEMORY_CAPACITY.minimum} to ${MEMORY_CAPACITY.maximum}.`,
      );
    }
    this.#archiveCapacity = archiveCapacity;
    if (!Number.isSafeInteger(notebookCapacity)
        || notebookCapacity < NOTEBOOK_CAPACITY.minimum
        || notebookCapacity > NOTEBOOK_CAPACITY.maximum) {
      throw new ResearchMemoryError(
        `Research notebook capacity must be an integer from `
        + `${NOTEBOOK_CAPACITY.minimum} to ${NOTEBOOK_CAPACITY.maximum}.`,
      );
    }
    this.#notebookCapacity = notebookCapacity;
  }

  #assertOpen() {
    if (this.#closed) throw new ResearchMemoryError('This research memory has already been closed.');
  }

  async [MEMORY_TRANSACTION](operation) {
    this.#assertOpen();
    const snapshot = {
      bufferRecords: cloneJson([...this.#buffer.records.values()]),
      archive: cloneMap(this.#archive),
      nextObservationId: this.#nextObservationId,
      evictions: this.#evictions,
      notebookMemberships: cloneMap(this.#notebookMemberships),
      notebookEntries: cloneMap(this.#notebookEntries),
    };
    try {
      return await operation();
    } catch (error) {
      this.#buffer.clear();
      for (const record of snapshot.bufferRecords) this.#buffer.insert(record);
      this.#archive = snapshot.archive;
      this.#rebuildArchivedCanonical();
      this.#nextObservationId = snapshot.nextObservationId;
      this.#evictions = snapshot.evictions;
      this.#notebookMemberships = snapshot.notebookMemberships;
      this.#notebookEntries = snapshot.notebookEntries;
      throw error;
    }
  }

  ingest(event, observation, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'In-memory ingest options');
    rejectUnknownKeys(options, new Set(), 'in-memory ingest option');
    assertCanonicalEvent(event);
    const normalized = normalizeObservation(observation);
    // Validation and relationship derivation must complete before owned state changes.
    const canonical = cloneJson(event);
    // Derive before insertion so invalid relationship material cannot cause a
    // partial mutation. IndexedObservationBuffer derives again from the owned clone.
    deriveEventRelationships(canonical);
    const stored = this.#buffer.records.has(canonical.id);
    if (!stored) this.#buffer.insert({ event: canonical, observations: [] });
    const recorded = { id: this.#nextObservationId++, ...normalized };
    this.#buffer.records.get(canonical.id).observations.push(recorded);
    const evicted = [];
    if (this.#buffer.records.size > this.#capacity) {
      const oldest = this.#buffer.records.keys().next().value;
      this.#buffer.remove(oldest);
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
    return this.#resolveEventRecord(eventId).record;
  }

  select(query = {}) {
    this.#assertOpen();
    const normalized = normalizeEventQuery(query);
    const records = this.#completeRecords();
    const events = [...records.values()].map(({ event }) => event);
    const ids = resolvePrefixes(normalized.ids, events.map(({ id }) => id), 'event ID');
    const authors = resolvePrefixes(
      normalized.authors, events.map(({ pubkey }) => pubkey), 'author public key',
    );
    const results = [];
    for (const [eventId, { event, observations }] of records) {
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
    return executeCollectionOperation(this, value, stages);
  }

  /** Returns the literal public field and operation vocabulary for local pipelines. */
  describeCollectionPipeline() {
    this.#assertOpen();
    return engineCollectionPipelineSchema();
  }

  validateSelection(query) {
    this.#assertOpen();
    normalizeEventQuery(query);
  }

  validateTransform(stages, inputKind, itemKind = inputKind) {
    this.#assertOpen();
    return validateCollectionOperation(stages, inputKind, itemKind);
  }

  validateNotebookMembership(name, options = {}, collectionKind = undefined) {
    this.#assertOpen();
    normalizeMembershipName(name);
    assertPlainObject(options, 'Notebook membership options');
    rejectUnknownKeys(options, new Set(['reason', 'attribution']), 'notebook membership option');
    if (options.reason !== undefined) normalizeReason(options.reason);
    if (collectionKind !== undefined) validateNotebookCollectionKind(collectionKind);
  }

  validatePreservation(options, collectionKind = undefined) {
    this.#assertOpen();
    assertPlainObject(options, 'Evidence preservation options');
    rejectUnknownKeys(options, new Set(['level', 'reason', 'excerptLimit']),
      'evidence preservation option');
    if (!['reference', 'excerpt', 'canonical'].includes(options.level)) {
      throw new ResearchMemoryError(
        'Evidence preservation level must be reference, excerpt, or canonical.',
      );
    }
    normalizeReason(options.reason);
    const excerptConstraint = RESEARCH_CONSTRAINTS.memory.archiveExcerptLimit;
    if (options.excerptLimit !== undefined
        && (!Number.isSafeInteger(options.excerptLimit)
          || options.excerptLimit < excerptConstraint.minimum
          || options.excerptLimit > excerptConstraint.maximum)) {
      throw new ResearchMemoryError(
        `Evidence excerptLimit must be an integer from ${excerptConstraint.minimum} `
        + `to ${excerptConstraint.maximum}.`,
      );
    }
    if (collectionKind !== undefined && !SUBJECT_COLLECTION_KINDS.includes(collectionKind)) {
      throw new ResearchMemoryError('Evidence preservation requires a subject collection.');
    }
  }

  asCollection(value) {
    this.#assertOpen();
    if (value?.type === 'notebook-membership') {
      const membership = this.getMembership(value.name);
      return resultCollection(membership.members.map((item) => ({
        subject: subject(item.type, item.id),
        reasons: item.reasons,
        provenance: [],
      })), { operation: 'notebook-membership', name: membership.name });
    }
    if (value?.type === 'result-collection') {
      assertResultCollection(value);
      return resultCollection(value.items.map((item) => this.#resolveCollectionItem(item)),
        value.context, value.kind);
    }
    if (value?.type === 'typed-collection') {
      assertTypedCollection(value);
      return typedCollection(value.kind, value.items, value.context, value.itemKind);
    }
    if (value?.collection?.type === 'result-collection') return this.asCollection(value.collection);
    throw new ResearchMemoryError('Unsupported public result shape.');
  }

  lookup(reference) {
    this.#assertOpen();
    const decodedReference = typeof reference === 'string'
      ? decodeNostrReference(reference) : null;
    const item = this.#resolveTyped(normalizeSubject(decodedReference?.subject ?? reference));
    if (!['event', 'account', 'address'].includes(item.type)) {
      throw new ResearchMemoryError('Exact lookup supports event, account, and address subjects.');
    }
    const resolved = this.#resolveCollectionItem({
      subject: item,
      reasons: [{ type: 'exact-subject' }],
    });
    return resultCollection([resolved], {
      operation: 'exact-subject-lookup',
      ...(decodedReference ? { decodedReference } : {}),
    },
      item.type === 'event' ? 'events' : item.type === 'account' ? 'accounts' : 'addresses');
  }

  /**
   * Deliberately copies selected evidence into the bounded archive. Validation
   * and capacity checks complete before the first archive entry is changed.
   */
  preserve(value, options = {}) {
    this.#assertOpen();
    this.validatePreservation(options);
    const level = options.level;
    const reason = normalizeReason(options.reason);
    const excerptLimit = options.excerptLimit ?? 280;
    const collection = this.asCollection(value);
    const prepared = collection.items.map(({ subject: item }) => {
      const resolution = item.type === 'event'
        ? this.#resolveEventRecord(item.id)
        : item.type === 'account'
          ? this.#resolveAccountEvidence(item.id)
          : item.type === 'address'
            ? this.#resolveAddressEvidence(item.id)
            : { source: 'unresolved', record: null };
      if (level !== 'reference' && !resolution.record) {
        throw new ResearchMemoryError(
          `Cannot preserve ${level} evidence for unresolved ${item.type}:${item.id}.`,
        );
      }
      const entry = {
        subject: cloneJson(item),
        level,
        reason: cloneJson(reason),
        preservedAt: new Date().toISOString(),
      };
      if (level === 'excerpt') {
        entry.excerpt = evidenceExcerpt(item, resolution.record, excerptLimit);
      } else if (level === 'canonical') {
        const canonical = item.type === 'event' || item.type === 'address'
          ? resolution.record : {
              event: resolution.record.metadataEvent,
              observations: resolution.record.observations,
            };
        entry.canonical = cloneJson(canonical);
      }
      return [memberKey(item), entry];
    });
    const uniquePrepared = new Map(prepared);
    const additions = [...uniquePrepared.keys()].filter((key) => !this.#archive.has(key)).length;
    if (this.#archive.size + additions > this.#archiveCapacity) {
      throw new ResearchMemoryError(
        `Evidence archive capacity ${this.#archiveCapacity} cannot accommodate `
        + `${additions} new entries.`,
      );
    }
    for (const [key, entry] of uniquePrepared) {
      this.#archive.set(key, cloneJson(entry));
    }
    this.#rebuildArchivedCanonical();
    return {
      type: 'archive-mutation',
      level,
      count: uniquePrepared.size,
      entries: [...uniquePrepared.values()].map(publicArchiveSummary),
    };
  }

  archived(options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'Evidence archive query');
    rejectUnknownKeys(options, new Set(['subject', 'level', 'limit']), 'evidence archive query');
    const wanted = options.subject === undefined ? null : normalizeSubject(options.subject);
    if (options.level !== undefined
        && !['reference', 'excerpt', 'canonical'].includes(options.level)) {
      throw new ResearchMemoryError('Archive level must be reference, excerpt, or canonical.');
    }
    const limit = options.limit ?? RESEARCH_CONSTRAINTS.results.defaultQueryLimit;
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > MAX_QUERY_LIMIT) {
      throw new ResearchMemoryError(`Archive limit must be an integer from 0 to ${MAX_QUERY_LIMIT}.`);
    }
    const entries = [...this.#archive.values()]
      .filter((entry) => !wanted || memberKey(entry.subject) === memberKey(wanted))
      .filter((entry) => options.level === undefined || entry.level === options.level)
      .sort((left, right) => memberKey(left.subject).localeCompare(memberKey(right.subject)));
    return {
      type: 'evidence-archive',
      count: entries.length,
      entries: entries.slice(0, limit).map(publicArchiveEntry),
      omitted: Math.max(0, entries.length - limit),
    };
  }

  releaseEvidence(references) {
    this.#assertOpen();
    if (!Array.isArray(references) || references.length === 0) {
      throw new ResearchMemoryError('Archive release requires a non-empty subject array.');
    }
    const subjects = references.map(normalizeSubject);
    const keys = [...new Set(subjects.map(memberKey))];
    const released = [];
    for (const key of keys) {
      const entry = this.#archive.get(key);
      if (!entry) continue;
      this.#archive.delete(key);
      released.push(entry.subject);
    }
    this.#rebuildArchivedCanonical();
    return { type: 'released-archived-evidence', count: released.length, subjects: released };
  }

  #rebuildArchivedCanonical() {
    this.#archivedCanonical.clear();
    for (const entry of this.#archive.values()) {
      if (entry.level === 'canonical') this.#archivedCanonical.insert(entry.canonical);
    }
  }

  #resolveEventRecord(eventId) {
    const archived = this.#archivedCanonical.records.get(eventId);
    const buffered = this.#buffer.records.get(eventId);
    if (!archived && !buffered) return { source: 'unresolved', record: null };
    const primary = archived ?? buffered;
    const observations = [];
    mergeUniqueJson(observations, archived?.observations ?? []);
    mergeUniqueJson(observations, buffered?.observations ?? []);
    return {
      source: archived ? 'archive' : 'buffer',
      record: cloneJson({ event: primary.event, observations }),
    };
  }

  #resolveAccountEvidence(publicKey) {
    const metadata = this.#currentByKey(publicKey, 0);
    if (!metadata) return { source: 'unresolved', record: null };
    const resolved = this.#resolveEventRecord(metadata.event.id);
    return {
      source: resolved.source,
      record: {
        profile: parseProfile(metadata.event),
        metadataEvent: metadata.event,
        observations: metadata.observations,
      },
    };
  }

  #resolveAddressEvidence(coordinate) {
    const parsed = parseAddress(coordinate);
    const current = this.#currentByKey(parsed.pubkey, parsed.kind, parsed.d);
    if (!current) return { source: 'unresolved', record: null };
    return this.#resolveEventRecord(current.event.id);
  }

  #completeRecords() {
    const records = new Map();
    for (const id of new Set([
      ...this.#archivedCanonical.records.keys(),
      ...this.#buffer.records.keys(),
    ])) records.set(id, this.#resolveEventRecord(id).record);
    return records;
  }

  #relationships(direction, key) {
    return uniqueJson([
      ...(this.#archivedCanonical[direction].get(key) ?? []),
      ...(this.#buffer[direction].get(key) ?? []),
    ]);
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
    } else if (reference.type === 'address') {
      record = this.#resolveAddressEvidence(reference.id).record;
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
        : subject('event', resolveOnePrefix(item.id, [...this.#completeRecords().keys()], 'event ID'));
    }
    if (item.type === 'account') {
      return EVENT_ID.test(item.id)
        ? subject('account', item.id)
        : this.#resolveAccountSubject(item.id);
    }
    if (item.type === 'address') return subject('address', item.id);
    return subject(item.type, item.id);
  }

  #accountKeys() {
    const keys = new Set([
      ...this.#buffer.authors.keys(),
      ...this.#archivedCanonical.authors.keys(),
    ]);
    for (const relations of [
      ...this.#buffer.outbound.values(),
      ...this.#archivedCanonical.outbound.values(),
    ]) {
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
    const candidates = [...this.#completeRecords().values()]
      .filter(({ event }) => event.kind === kind
        && event.pubkey === publicKey
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
    const starts = normalizeStartingSubjects(starting).map((item) => this.#resolveTyped(item));
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
          ? this.#relationships('outbound', memberKey(current.subject)) : []),
        ...(normalized.direction !== 'outbound'
          ? this.#relationships('inbound', memberKey(current.subject)) : []),
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
              this.#resolveEventRecord(relation.sourceEventId).record?.observations ?? [],
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
    const decodedReference = typeof reference === 'string'
      ? decodeNostrReference(reference) : null;
    const item = normalizeSubject(decodedReference?.subject ?? reference);
    const referenceContext = decodedReference ? { decodedReference } : {};
    if (item.type === 'event') {
      const resolution = this.#resolveEventRecord(item.id);
      const record = resolution.record;
      return {
        subject: item,
        resolved: Boolean(record),
        resident: resolution.source === 'buffer',
        resolutionSource: resolution.source,
        evidence: record,
        provenance: record?.observations ?? [],
        relationships: cloneJson(this.#relationships('outbound', memberKey(item))),
        ...referenceContext,
      };
    }
    if (item.type === 'account') {
      const resolution = this.#resolveAccountEvidence(item.id);
      const evidence = resolution.record;
      return {
        subject: item,
        resolved: Boolean(evidence),
        resident: resolution.source === 'buffer',
        resolutionSource: resolution.source,
        evidence,
        provenance: evidence?.observations ?? [],
        ...referenceContext,
      };
    }
    if (item.type === 'address') {
      const resolution = this.#resolveAddressEvidence(item.id);
      const evidence = resolution.record;
      return {
        subject: item,
        resolved: Boolean(evidence),
        resident: resolution.source === 'buffer',
        resolutionSource: resolution.source,
        evidence,
        provenance: evidence?.observations ?? [],
        relationships: cloneJson(this.#relationships('inbound', memberKey(item))),
        ...referenceContext,
      };
    }
    const collection = this.traverse([item], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: this.#capacity,
    });
    return {
      subject: item, resident: collection.context.relationships.length > 0, collection,
      ...referenceContext,
    };
  }

  remember(reference, value) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    const entry = normalizeNotebookEntry(value);
    const key = memberKey(item);
    const existing = this.#notebookEntries.get(key);
    if (!existing && this.#notebookEntries.size >= this.#notebookCapacity) {
      throw new ResearchMemoryError(`Research notebook entry capacity ${this.#notebookCapacity} has been reached.`);
    }
    const now = new Date().toISOString();
    const stored = {
      subject: item,
      kind: entry.kind,
      reason: entry.reason,
      attribution: entry.attribution,
      sourceReferences: entry.sourceReferences,
      labels: entry.labels,
      note: entry.note,
      ...(entry.judgment === undefined ? {} : { judgment: entry.judgment }),
      ...(entry.strength === undefined ? {} : { strength: entry.strength }),
      ...(entry.summary === undefined ? {} : { summary: entry.summary }),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.#notebookEntries.set(key, stored);
    return cloneJson(stored);
  }

  getNotebookEntry(reference) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    return cloneJson(this.#notebookEntries.get(memberKey(item)) ?? null);
  }

  notebook(query = {}) {
    this.#assertOpen();
    const normalized = normalizeNotebookQuery(query);
    const items = [...this.#notebookEntries.values()]
      .filter((entry) => normalized.labels.every(
        (label) => entry.labels.includes(label),
      ))
      .filter((entry) => normalized.judgments.length === 0
        || normalized.judgments.includes(entry.judgment))
      .sort((left, right) => (
        right.updatedAt.localeCompare(left.updatedAt)
        || memberKey(left.subject).localeCompare(memberKey(right.subject))
      ))
      .slice(0, normalized.limit)
      .map((entry) => ({
        subject: entry.subject,
        role: 'discovery',
        reasons: [{ type: 'notebook-entry', entry }],
        provenance: entry.sourceReferences,
      }));
    return resultCollection(items, {
      operation: 'notebook-query',
      labels: normalized.labels,
      judgments: normalized.judgments,
      limit: normalized.limit,
    });
  }

  forget(reference) {
    this.#assertOpen();
    const item = normalizeSubject(reference);
    return { subject: item, removed: this.#notebookEntries.delete(memberKey(item)) };
  }

  #createMembership(name, entries, options = {}) {
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
    const normalizedName = normalizeMembershipName(name);
    if (!this.#notebookMemberships.has(normalizedName)
        && this.#notebookMemberships.size >= this.#notebookCapacity) {
      throw new ResearchMemoryError(`Research notebook membership capacity ${this.#notebookCapacity} has been reached.`);
    }
    const record = {
      id: normalizedName, name: normalizedName, createdAt: new Date().toISOString(),
      members: [...members.values()].sort((a, b) => memberKey(a).localeCompare(memberKey(b))),
    };
    this.#notebookMemberships.set(record.name, cloneJson(record));
    const summary = this.#membershipSummary(record, 10);
    return {
      type: 'notebook-membership',
      id: summary.id, name: summary.name, createdAt: summary.createdAt,
      memberCount: summary.memberCount, reasonCount: summary.reasonCount,
      preview: summary.preview,
    };
  }

  #membershipSummary(
    set,
    previewLimit = RESEARCH_CONSTRAINTS.presentation.previewLimit.default,
  ) {
    const counts = Object.fromEntries([...NOTEBOOK_SUBJECT_TYPES].map((type) => [type, 0]));
    for (const member of set.members) counts[member.type] += 1;
    return {
      id: set.id, name: set.name, createdAt: set.createdAt,
      memberCount: set.members.length,
      reasonCount: set.members.reduce((total, item) => total + item.reasons.length, 0),
      counts, preview: set.members.slice(0, previewLimit).map(({ type, id }) => ({ type, id })),
    };
  }

  getMembership(name) {
    this.#assertOpen();
    const normalizedName = normalizeMembershipName(name);
    const set = this.#notebookMemberships.get(normalizedName);
    if (!set) {
      throw new ResearchMemoryError(`No notebook membership found for name ${normalizedName}.`);
    }
    return cloneJson(set);
  }

  listMemberships() {
    this.#assertOpen();
    return [...this.#notebookMemberships.values()]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((set) => this.#membershipSummary(set));
  }

  replaceMembership(name, collection, options = {}) {
    const normalizedName = normalizeMembershipName(name);
    const previous = this.getMembership(normalizedName);
    collection = this.asCollection(collection);
    validateNotebookCollectionKind(collection.kind);
    assertPlainObject(options, 'Notebook membership replacement options');
    rejectUnknownKeys(options, new Set(['name', 'reason', 'attribution']), 'notebook membership replacement options');
    const membershipContext = options.reason ? normalizeReason(options.reason) : undefined;
    const attribution = normalizeMembershipAttribution(options.attribution);
    const entries = collection.items
      .filter((item) => NOTEBOOK_SUBJECT_TYPES.has(item.subject.type))
      .map((item) => ({
        member: item.subject,
        reasons: (item.reasons.length ? item.reasons : [{ type: 'remembered-result' }])
          .map((reason) => ({
            ...reason, ...(membershipContext ? { membershipContext } : {}),
            operation: collection.context.operation, attribution,
            sourceReferences: membershipProvenance(item),
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
      id: previous.id,
      name: previous.name,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
      members: [...members.values()].sort((a, b) => memberKey(a).localeCompare(memberKey(b))),
    };
    this.#notebookMemberships.set(previous.name, cloneJson(replacement));
    return this.#membershipSummary(replacement, 10);
  }

  deleteMembership(name) {
    const normalizedName = normalizeMembershipName(name);
    const membership = this.getMembership(normalizedName);
    this.#notebookMemberships.delete(membership.name);
    return { name: membership.name, deleted: true };
  }

  rememberMembership(collection, name, options = {}) {
    collection = this.asCollection(collection);
    validateNotebookCollectionKind(collection.kind);
    assertPlainObject(options, 'Notebook membership options');
    rejectUnknownKeys(options, new Set(['reason', 'attribution', 'signal']), 'notebook membership options');
    const membershipContext = options.reason ? normalizeReason(options.reason) : undefined;
    const attribution = normalizeMembershipAttribution(options.attribution);
    return this.#createMembership(name, collection.items
      .filter((item) => NOTEBOOK_SUBJECT_TYPES.has(item.subject.type))
      .map((item) => ({
        member: item.subject,
        reasons: (item.reasons.length ? item.reasons : [{ type: 'remembered-result' }])
          .map((reason) => ({
            ...reason, ...(membershipContext ? { membershipContext } : {}),
            operation: collection.context.operation, attribution,
            sourceReferences: membershipProvenance(item),
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
        const resolutionSource = this.inspect(reference).resolutionSource;
        projection = record ? (mode === 'full'
          ? { type: 'event', id: reference.id, resolutionSource, ...record }
          : {
              type: 'event', id: reference.id, kind: record.event.kind,
              resolutionSource,
              author: this.#accountSummary(
                record.event.pubkey,
                options.excerptLimit ?? RESEARCH_CONSTRAINTS.presentation.excerptLimit.default,
              ),
              createdAt: record.event.created_at,
              contentExcerpt: excerpt(
                record.event.content,
                options.excerptLimit ?? RESEARCH_CONSTRAINTS.presentation.excerptLimit.default,
              ),
              relayCount: distinctRelays(record.observations).length,
              relays: distinctRelays(record.observations),
            }) : { type: 'event', id: reference.id, resolved: false };
      } else if (reference.type === 'account') {
        const summary = this.#accountSummary(
          reference.id,
          options.excerptLimit ?? RESEARCH_CONSTRAINTS.presentation.excerptLimit.default,
        );
        const metadata = this.#currentByKey(reference.id, 0);
        const resolutionSource = this.inspect(reference).resolutionSource;
        projection = {
          type: 'account', id: reference.id, resolved: Boolean(metadata), resolutionSource, ...summary,
          ...(mode === 'full' && metadata ? {
            profile: parseProfile(metadata.event),
            metadataEvent: metadata.event, observations: metadata.observations,
          } : {}),
        };
      } else if (reference.type === 'address') {
        const resolution = this.#resolveAddressEvidence(reference.id);
        projection = {
          type: 'address',
          id: reference.id,
          resolved: Boolean(resolution.record),
          resolutionSource: resolution.source,
          ...(resolution.record ? {
            currentEventId: resolution.record.event.id,
            kind: resolution.record.event.kind,
            author: resolution.record.event.pubkey,
            createdAt: resolution.record.event.created_at,
            ...(mode === 'full' ? resolution.record : {}),
          } : {}),
        };
      } else projection = reference;
      return {
        ...projection,
        ...(this.#notebookEntries.has(memberKey(reference))
          ? { notebookEntry: cloneJson(this.#notebookEntries.get(memberKey(reference))) } : {}),
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

  #accountSummary(
    publicKey,
    excerptLimit = RESEARCH_CONSTRAINTS.presentation.excerptLimit.default,
  ) {
    const metadata = this.#currentByKey(publicKey, 0);
    const profile = metadata ? parseProfile(metadata.event) : {};
    const observations = [...this.#completeRecords().values()]
      .filter(({ event }) => event.pubkey === publicKey)
      .flatMap(({ observations: found }) => found);
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
    const buffer = this.#buffer.describe(this.#capacity, this.#evictions);
    return {
      observationBuffer: buffer,
      archive: {
        capacity: this.#archiveCapacity,
        entryCount: this.#archive.size,
        remainingCapacity: this.#archiveCapacity - this.#archive.size,
        levels: countedArchiveLevels(this.#archive.values()),
      },
      notebook: {
        entryCount: this.#notebookEntries.size,
        membershipCount: this.#notebookMemberships.size,
        capacity: this.#notebookCapacity,
      },
    };
  }

  reset() {
    this.#assertOpen();
    this.#buffer.clear();
    this.#archive.clear();
    this.#archivedCanonical.clear();
    this.#notebookMemberships.clear();
    this.#notebookEntries.clear();
    this.#nextObservationId = 1; this.#evictions = 0;
  }

  close() {
    if (!this.#closed) {
      this.reset();
      this.#closed = true;
    }
  }
}

function evidenceExcerpt(item, record, limit) {
  if (item.type === 'event' || item.type === 'address') {
    return {
      eventId: record.event.id,
      author: record.event.pubkey,
      kind: record.event.kind,
      createdAt: record.event.created_at,
      content: excerpt(record.event.content, limit),
      tags: cloneJson(record.event.tags.slice(0, 20)),
      provenance: cloneJson(record.observations),
    };
  }
  if (item.type === 'account') {
    return {
      publicKey: item.id,
      metadataEventId: record.metadataEvent.id,
      profile: {
        name: record.profile.name,
        display_name: record.profile.display_name,
        nip05: record.profile.nip05,
        about: typeof record.profile.about === 'string'
          ? excerpt(record.profile.about, limit) : undefined,
      },
      provenance: cloneJson(record.observations),
    };
  }
  throw new ResearchMemoryError('Excerpt preservation supports event and account subjects.');
}

function publicArchiveEntry(entry) {
  return cloneJson({
    subject: entry.subject,
    level: entry.level,
    reason: entry.reason,
    preservedAt: entry.preservedAt,
    ...(entry.excerpt ? { excerpt: entry.excerpt } : {}),
    ...(entry.canonical ? { canonical: entry.canonical } : {}),
  });
}

function publicArchiveSummary(entry) {
  return cloneJson({
    subject: entry.subject,
    level: entry.level,
    reason: entry.reason,
    preservedAt: entry.preservedAt,
  });
}

function countedArchiveLevels(entries) {
  const levels = { reference: 0, excerpt: 0, canonical: 0 };
  for (const entry of entries) levels[entry.level] += 1;
  return levels;
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
  const unsupported = relationshipTypes.filter(
    (type) => !NAVIGATION_RELATIONSHIP_TYPE_SET.has(type),
  );
  if (unsupported.length) {
    throw new ResearchMemoryError(`Unsupported traversal relationship types: ${unsupported.join(', ')}.`);
  }
  const direction = options.direction ?? 'outbound';
  if (!['inbound', 'outbound', 'both'].includes(direction)) {
    throw new ResearchMemoryError('Traversal direction must be "inbound", "outbound", or "both".');
  }
  const depth = options.depth ?? 1;
  const depthConstraint = RESEARCH_CONSTRAINTS.memory.traversalDepth;
  if (!Number.isSafeInteger(depth)
      || depth < depthConstraint.minimum || depth > depthConstraint.maximum) {
    throw new ResearchMemoryError(
      `Traversal depth must be an integer from ${depthConstraint.minimum} `
      + `to ${depthConstraint.maximum}.`,
    );
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
  if (value.items.length > 0 && value.kind !== undefined
      && value.kind !== 'subjects' && value.kind !== inferred) {
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
  throw new ResearchMemoryError(`Unsupported typed collection kind: ${value.kind}.`);
}

function inferSubjectCollectionKind(items) {
  const types = new Set(items.map((item) => normalizeSubject(item.subject).type));
  if (types.size === 0) return 'subjects';
  if (types.size > 1) return 'subjects';
  const type = [...types][0];
  return type === 'event' ? 'events'
    : type === 'account' ? 'accounts'
      : type === 'address' ? 'addresses'
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

function normalizeStartingSubjects(starting) {
  const value = starting?.type === 'result-collection'
    ? starting.items.map(({ subject: item }) => item)
    : Array.isArray(starting) ? starting : [starting];
  const subjects = [];
  for (const raw of value) {
    const item = normalizeSubject(raw);
    subjects.push(item);
  }
  return uniqueSubjects(subjects);
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
  if (!Number.isSafeInteger(value)
      || value < 1 || value > RESEARCH_CONSTRAINTS.results.maximumLimit) {
    throw new ResearchMemoryError(
      `${label} must be an integer from 1 to `
      + `${RESEARCH_CONSTRAINTS.results.maximumLimit}.`,
    );
  }
  return value;
}

const TRANSFORM_KINDS = new Set(SUBJECT_COLLECTION_KINDS);
function validateNotebookCollectionKind(kind) {
  if (!TRANSFORM_KINDS.has(kind)) {
    throw new ResearchMemoryError(
      `Notebook membership requires a subject collection; ${kind} collections contain no stable subjects.`,
    );
  }
}
function typedCollection(kind, items, context, itemKind = kind) {
  return {
    type: 'typed-collection', kind, itemKind,
    items: cloneJson(items), context: cloneJson(context),
  };
}

function uniqueJson(values) {
  const found = new Map();
  for (const value of values) found.set(stableJson(value), cloneJson(value));
  return [...found.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
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

function normalizeMembershipName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ResearchMemoryError('Notebook membership name must be a non-empty string.');
  }
  return name.trim();
}

function normalizeMembershipAttribution(attribution = 'caller') {
  if (typeof attribution !== 'string' || attribution.trim().length === 0) {
    throw new ResearchMemoryError('Notebook membership attribution must be a non-empty string.');
  }
  return attribution.trim();
}

function normalizeMember(member) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) {
    throw new ResearchMemoryError('Notebook membership member must be an object.');
  }
  if (!NOTEBOOK_SUBJECT_TYPES.has(member.type)) {
    throw new ResearchMemoryError('Notebook membership member has an unsupported subject type.');
  }
  if (typeof member.id !== 'string' || member.id.length === 0
      || (['event', 'account'].includes(member.type) && !EVENT_ID.test(member.id))
      || (member.type === 'address' && !parseAddress(member.id))) {
    throw new ResearchMemoryError(
      'Notebook membership member ID must be a stable canonical subject ID.',
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

function normalizeNotebookEntry(value) {
  assertPlainObject(value, 'Notebook entry');
  rejectUnknownKeys(
    value,
    new Set(['kind', 'labels', 'note', 'judgment', 'strength', 'reason', 'attribution',
      'sourceReferences', 'summary']),
    'notebook entry',
  );
  const kind = value.kind ?? (value.judgment === undefined ? 'note' : 'judgment');
  if (!['judgment', 'note', 'derived-observation', 'summary'].includes(kind)) {
    throw new ResearchMemoryError('Notebook entry kind is invalid.');
  }
  if (typeof value.reason !== 'string' || value.reason.trim().length === 0) {
    throw new ResearchMemoryError('Notebook entry reason must be a non-empty string.');
  }
  if (typeof value.attribution !== 'string' || value.attribution.trim().length === 0) {
    throw new ResearchMemoryError('Notebook entry attribution must be a non-empty string.');
  }
  const sourceReferences = value.sourceReferences ?? [];
  if (!Array.isArray(sourceReferences)) {
    throw new ResearchMemoryError('Notebook sourceReferences must be an array.');
  }
  if (sourceReferences.length > RESEARCH_CONSTRAINTS.notebook.sourceReferences.maximum) {
    throw new ResearchMemoryError(
      `Notebook sourceReferences are limited to `
      + `${RESEARCH_CONSTRAINTS.notebook.sourceReferences.maximum} stable subjects.`,
    );
  }
  const normalizedReferences = sourceReferences.map(normalizeSubject);
  if (value.summary !== undefined
      && stableJson(value.summary).length > RESEARCH_CONSTRAINTS.notebook.summaryLength.maximum) {
    throw new ResearchMemoryError(
      `Notebook summaries are limited to `
      + `${RESEARCH_CONSTRAINTS.notebook.summaryLength.maximum} serialized characters.`,
    );
  }
  const labels = value.labels === undefined ? [] : normalizeStringList(value.labels, 'labels', false);
  const uniqueLabels = [...new Set((labels ?? []).map((label) => label.trim()))].sort();
  if (uniqueLabels.some((label) => label.length === 0)) {
    throw new ResearchMemoryError('Notebook labels must be non-empty strings.');
  }
  const note = value.note ?? '';
  if (typeof note !== 'string') throw new ResearchMemoryError('Notebook note must be a string.');
  const judgment = value.judgment;
  if (judgment !== undefined
      && !NOTEBOOK_JUDGMENTS.includes(judgment)) {
    throw new ResearchMemoryError(
      'Notebook judgment must be interested, uninterested, uncertain, or anchor.',
    );
  }
  const strength = value.strength;
  if (strength !== undefined
      && (typeof strength !== 'number' || !Number.isFinite(strength)
        || strength < 0 || strength > 1)) {
    throw new ResearchMemoryError('Notebook strength must be a number from 0 to 1.');
  }
  if (uniqueLabels.length === 0 && note.trim().length === 0 && judgment === undefined
      && value.summary === undefined) {
    throw new ResearchMemoryError(
      'A notebook entry requires a label, note, judgment, or bounded summary.',
    );
  }
  return {
    kind,
    reason: value.reason.trim(),
    attribution: value.attribution.trim(),
    sourceReferences: normalizedReferences,
    labels: uniqueLabels,
    note,
    ...(judgment === undefined ? {} : { judgment }),
    ...(strength === undefined ? {} : { strength }),
    ...(value.summary === undefined ? {} : { summary: cloneJson(value.summary) }),
  };
}

function normalizeNotebookQuery(query) {
  assertPlainObject(query, 'Notebook query');
  rejectUnknownKeys(query, new Set(['labels', 'judgments', 'limit']), 'notebook query');
  const labels = query.labels === undefined ? [] : normalizeStringList(
    query.labels, 'labels', false,
  );
  const judgments = query.judgments === undefined ? [] : normalizeStringList(
    query.judgments, 'judgments', false,
  );
  if (judgments.some(
    (judgment) => !NOTEBOOK_JUDGMENTS.includes(judgment),
  )) {
    throw new ResearchMemoryError(
      'Notebook judgments must be interested, uninterested, uncertain, or anchor.',
    );
  }
  return {
    labels: [...new Set((labels ?? []).map((label) => label.trim()))].sort(),
    judgments: [...new Set(judgments ?? [])].sort(),
    limit: normalizeLimit(query.limit),
  };
}

function membershipProvenance(item) {
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

function cloneMap(map) {
  return new Map([...map].map(([key, value]) => [key, cloneJson(value)]));
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
