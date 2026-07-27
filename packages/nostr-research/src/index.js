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
const SUBJECT_TYPES = new Set(['event', 'account', 'tag']);
const NOTEBOOK_SUBJECT_TYPES = new Set(['event', 'account', 'tag']);
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

/** Creates the authoritative bounded, process-local research memory. */
export function createInMemoryResearchMemory(options = {}) {
  assertPlainObject(options, 'In-memory research memory options');
  rejectUnknownKeys(options, new Set(['capacity', 'archiveCapacity']), 'in-memory research memory option');
  const capacity = options.capacity;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_QUERY_LIMIT) {
    throw new ResearchMemoryError(
      `In-memory research memory capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }
  const archiveCapacity = options.archiveCapacity ?? capacity;
  if (!Number.isSafeInteger(archiveCapacity) || archiveCapacity < 1
      || archiveCapacity > MAX_QUERY_LIMIT) {
    throw new ResearchMemoryError(
      `Evidence archive capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }
  return new InMemoryResearchMemory(capacity, archiveCapacity);
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

/** The single authoritative bounded process-local research memory. */
export class InMemoryResearchMemory {
  #capacity;
  #archiveCapacity;
  #notebookCapacity = MAX_QUERY_LIMIT;
  #closed = false;
  #buffer = new IndexedObservationBuffer();
  #archive = new Map();
  #archivedCanonical = new IndexedObservationBuffer();
  #nextObservationId = 1;
  #evictions = 0;
  #notebookMemberships = new Map();
  #notebookEntries = new Map();

  constructor(capacity, archiveCapacity = capacity) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_QUERY_LIMIT) {
      throw new ResearchMemoryError(
        `In-memory research memory capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
      );
    }
    this.#capacity = capacity;
    if (!Number.isSafeInteger(archiveCapacity) || archiveCapacity < 1
        || archiveCapacity > MAX_QUERY_LIMIT) {
      throw new ResearchMemoryError(
        `Evidence archive capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
      );
    }
    this.#archiveCapacity = archiveCapacity;
  }

  #assertOpen() {
    if (this.#closed) throw new ResearchMemoryError('This research memory has already been closed.');
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
    eventRelationships(canonical);
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
    if (options.excerptLimit !== undefined
        && (!Number.isSafeInteger(options.excerptLimit)
          || options.excerptLimit < 1 || options.excerptLimit > 2000)) {
      throw new ResearchMemoryError('Evidence excerptLimit must be an integer from 1 to 2000.');
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
        const canonical = item.type === 'event'
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
    const limit = options.limit ?? 50;
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
    const item = normalizeSubject(reference);
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
      };
    }
    const collection = this.traverse([item], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: this.#capacity,
    });
    return { subject: item, resident: collection.context.relationships.length > 0, collection };
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

  #membershipSummary(set, previewLimit = 5) {
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
    const set = this.#notebookMemberships.get(name);
    if (!set) throw new ResearchMemoryError(`No notebook membership found for name ${name}.`);
    return cloneJson(set);
  }

  listMemberships() {
    this.#assertOpen();
    return [...this.#notebookMemberships.values()]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((set) => this.#membershipSummary(set));
  }

  replaceMembership(name, collection, options = {}) {
    const previous = this.getMembership(name);
    collection = this.asCollection(collection);
    validateNotebookCollectionKind(collection.kind);
    assertPlainObject(options, 'Notebook membership replacement options');
    rejectUnknownKeys(options, new Set(['name', 'reason', 'attribution']), 'notebook membership replacement options');
    const membershipContext = options.reason ? normalizeReason(options.reason) : undefined;
    const attribution = options.attribution ?? 'caller';
    if (typeof attribution !== 'string' || attribution.trim().length === 0) {
      throw new ResearchMemoryError('Notebook membership attribution must be a non-empty string.');
    }
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
      name,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
      members: [...members.values()].sort((a, b) => memberKey(a).localeCompare(memberKey(b))),
    };
    this.#notebookMemberships.set(name, cloneJson(replacement));
    return this.#membershipSummary(replacement, 10);
  }

  deleteMembership(name) {
    this.getMembership(name);
    this.#notebookMemberships.delete(name);
    return { name, deleted: true };
  }

  rememberMembership(collection, name, options = {}) {
    collection = this.asCollection(collection);
    validateNotebookCollectionKind(collection.kind);
    assertPlainObject(options, 'Notebook membership options');
    rejectUnknownKeys(options, new Set(['reason', 'attribution', 'signal']), 'notebook membership options');
    const membershipContext = options.reason ? normalizeReason(options.reason) : undefined;
    const attribution = options.attribution ?? 'caller';
    if (typeof attribution !== 'string' || attribution.trim().length === 0) {
      throw new ResearchMemoryError('Notebook membership attribution must be a non-empty string.');
    }
    return this.#createMembership(name, collection.items
      .filter((item) => NOTEBOOK_SUBJECT_TYPES.has(item.subject.type))
      .map((item) => ({
        member: item.subject,
        reasons: (item.reasons.length ? item.reasons : [{ type: 'remembered-result' }])
          .map((reason) => ({
            ...reason, ...(membershipContext ? { membershipContext } : {}),
            operation: collection.context.operation, attribution: attribution.trim(),
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
              author: this.#accountSummary(record.event.pubkey, options.excerptLimit ?? 160),
              createdAt: record.event.created_at,
              contentExcerpt: excerpt(record.event.content, options.excerptLimit ?? 160),
              relayCount: distinctRelays(record.observations).length,
              relays: distinctRelays(record.observations),
            }) : { type: 'event', id: reference.id, resolved: false };
      } else if (reference.type === 'account') {
        const summary = this.#accountSummary(reference.id, options.excerptLimit ?? 160);
        const metadata = this.#currentByKey(reference.id, 0);
        const resolutionSource = this.inspect(reference).resolutionSource;
        projection = {
          type: 'account', id: reference.id, resolved: Boolean(metadata), resolutionSource, ...summary,
          ...(mode === 'full' && metadata ? {
            profile: parseProfile(metadata.event),
            metadataEvent: metadata.event, observations: metadata.observations,
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

  #accountSummary(publicKey, excerptLimit = 160) {
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
  if (item.type === 'event') {
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
    expanded.push(item);
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
  common: [
    'subject', 'subject.type', 'subject.id',
    'evidence.resident', 'evidence.resolutionSource', 'observedRelay',
  ],
  events: [
    'event.author', 'event.kind', 'event.text', 'event.createdAt', 'event.tag',
    'event.linkedDomain', 'event.hasMedia',
  ],
  accounts: ['account.name', 'account.display_name', 'account.description'],
});

function validateNotebookCollectionKind(kind) {
  if (!TRANSFORM_KINDS.has(kind)) {
    throw new ResearchMemoryError(
      `Notebook membership requires a subject collection; ${kind} collections contain no stable subjects.`,
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
    'filter', 'pick', 'project', 'distinct', 'sort', 'limit', 'sample',
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
  if (operation === 'pick') {
    rejectUnknownKeys(value, new Set(['operation', 'as', 'positions']), 'pick stage');
    if (!TRANSFORM_KINDS.has(inputKind)) {
      throw new ResearchMemoryError(`Pick does not support ${inputKind} collections.`);
    }
    if (!Array.isArray(value.positions) || value.positions.length === 0
        || value.positions.some((position) => (
          !Number.isSafeInteger(position) || position < 1 || position > MAX_QUERY_LIMIT
        ))) {
      throw new ResearchMemoryError(
        `Pick positions must be a non-empty array of integers from 1 to ${MAX_QUERY_LIMIT}.`,
      );
    }
    if (new Set(value.positions).size !== value.positions.length) {
      throw new ResearchMemoryError('Pick positions must be distinct.');
    }
    return { ...common, positions: [...value.positions].sort((left, right) => left - right) };
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
    'account.name', 'account.display_name', 'account.description',
    'evidence.resident', 'evidence.resolutionSource',
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
  else if (operation.operation === 'pick') output = applyPick(collection, operation);
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

function applyPick(collection, operation) {
  const last = operation.positions.at(-1);
  if (last > collection.items.length) {
    throw new ResearchMemoryError(
      `Pick position ${last} exceeds the input collection count ${collection.items.length}.`,
    );
  }
  return resultCollection(
    operation.positions.map((position) => collection.items[position - 1]),
    {},
    collection.kind,
  );
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
  if (field === 'evidence.resolutionSource') return item.subject
    ? memory.inspect(item.subject).resolutionSource : 'unresolved';
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
      'evidence.resolutionSource': stringPredicateSchema(),
    },
    events: {
      'subject.type': stringPredicateSchema(),
      'subject.id': stringPredicateSchema(),
      'evidence.resident': scalarPredicateSchema('boolean'),
      'evidence.resolutionSource': stringPredicateSchema(),
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
      'evidence.resolutionSource': stringPredicateSchema(),
      'account.name': stringPredicateSchema(),
      'account.display_name': stringPredicateSchema(),
      'account.description': stringPredicateSchema(),
    },
    relationships: {
      'subject.type': stringPredicateSchema(),
      'subject.id': stringPredicateSchema(),
      'evidence.resident': scalarPredicateSchema('boolean'),
      'evidence.resolutionSource': stringPredicateSchema(),
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
        'evidence.resolutionSource': 'string',
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
      relation: {
        kind: 'relation',
        operations: [
          'relate', 'filter', 'project', 'distinct', 'sort', 'limit',
          'join', 'aggregate', 'derive', 'slice',
        ],
        statement: 'Relations preserve values, stable subjects, reasons, and provenance across composable stages.',
      },
      pick: {
        inputKinds: [...TRANSFORM_KINDS],
        positions: `non-empty distinct 1-based integer[] up to ${MAX_QUERY_LIMIT}`,
        ordering: 'source collection order',
      },
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

function normalizeMembershipName(name) {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ResearchMemoryError('Notebook membership name must be a non-empty string.');
  }
  return name.trim();
}

function normalizeMember(member) {
  if (!member || typeof member !== 'object' || Array.isArray(member)) {
    throw new ResearchMemoryError('Notebook membership member must be an object.');
  }
  if (!NOTEBOOK_SUBJECT_TYPES.has(member.type)) {
    throw new ResearchMemoryError('Notebook membership member has an unsupported subject type.');
  }
  if (typeof member.id !== 'string' || member.id.length === 0
      || (['event', 'account'].includes(member.type) && !EVENT_ID.test(member.id))) {
    throw new ResearchMemoryError(
      'Notebook membership member ID must be stable; event and account IDs must be full 64-character lowercase hexadecimal values.',
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
  if (sourceReferences.length > 50) {
    throw new ResearchMemoryError('Notebook sourceReferences are limited to 50 stable subjects.');
  }
  const normalizedReferences = sourceReferences.map(normalizeSubject);
  if (value.summary !== undefined && stableJson(value.summary).length > 2000) {
    throw new ResearchMemoryError('Notebook summaries are limited to 2000 serialized characters.');
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
      && !['interested', 'uninterested', 'uncertain', 'anchor'].includes(judgment)) {
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
    (judgment) => !['interested', 'uninterested', 'uncertain', 'anchor'].includes(judgment),
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
  executeRelationOperation,
  isResearchRelation,
  relationFrom,
  relationOperationNames,
  validateRelationOperation,
} from './relation.js';
export {
  executePipelineExpand,
  executePipelineFetch,
  validatePipelineExpand,
  validatePipelineFetch,
} from './pipeline-source.js';
export {
  createDeclarativeResearchSession,
  DeclarativeResearchSession,
} from './interpreter.js';
