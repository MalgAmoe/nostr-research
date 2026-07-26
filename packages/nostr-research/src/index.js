import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateEvent, verifyEvent } from 'nostr-tools';

const EVENT_ID = /^[a-f0-9]{64}$/;
const HEX_PREFIX = /^[a-f0-9]{4,64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;
const DEFAULT_QUERY_LIMIT = 50;
const MAX_QUERY_LIMIT = 1000;
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
    })), { operation: 'selection', query: publicEventQuery(normalized) });
  }

  collection(items, context = {}) {
    this.#assertOpen();
    if (!Array.isArray(items)) throw new ResearchMemoryError('Collection items must be an array.');
    assertPlainObject(context, 'Collection context');
    const normalized = items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new ResearchMemoryError('Each collection item must be a result item.');
      }
      const normalizedSubject = normalizeSubject(item.subject);
      if (item.record !== undefined) this.#assertStoredRecord(normalizedSubject, item.record);
      return { ...cloneJson(item), subject: normalizedSubject };
    });
    return resultCollection(normalized, context);
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
      return cloneJson(value);
    }
    if (value?.collection?.type === 'result-collection') return this.asCollection(value.collection);
    if (Array.isArray(value?.acquiredObservations)) {
      return resultCollection(value.acquiredObservations.map(({ eventId, observations }) => ({
        subject: subject('event', eventId),
        reasons: [{ type: 'acquisition', requested: value.requested }],
        provenance: observations,
      })), { operation: 'acquisition', completionReason: value.completionReason });
    }
    if (Array.isArray(value?.results)) {
      return resultCollection(value.results.map((item) => ({
        subject: subject('account', item.publicKey),
        record: {
          profile: item.profile, metadataEvent: item.metadataEvent,
          observations: item.observations ?? [],
        },
        reasons: item.matchReasons ?? [], provenance: item.observations ?? [],
      })), { operation: 'account-search', query: value.query });
    }
    throw new ResearchMemoryError('Unsupported public result shape.');
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
    if (item.type === 'account') return this.#resolveAccountSubject(item.id);
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

  resolveAccount(publicKeyOrPrefix) {
    const publicKey = resolveOnePrefix(
      publicKeyOrPrefix, [...this.#corpus.authors.keys()], 'account public key',
    );
    const metadata = this.#currentByKey(publicKey, 0);
    if (!metadata) {
      throw new ResearchMemoryError(`No stored kind-0 metadata event found for account ${publicKey}.`);
    }
    return accountResult(publicKey, metadata, [{ type: 'public-key', value: publicKey }]);
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

  searchAccounts(query = {}) {
    this.#assertOpen();
    const normalized = normalizeAccountQuery(query);
    const results = [];
    for (const publicKey of [...this.#corpus.kinds.get(0) ?? []]
      .map((id) => this.#corpus.records.get(id).event.pubkey)
      .filter((key, i, all) => all.indexOf(key) === i).sort()) {
      if (normalized.publicKeys
        && !normalized.publicKeys.some((prefix) => publicKey.startsWith(prefix))) continue;
      const metadata = this.#currentByKey(publicKey, 0);
      const profile = parseProfile(metadata.event);
      const matchReasons = [];
      if (normalized.publicKeys) matchReasons.push({
        type: 'public-key-prefix',
        prefixes: normalized.publicKeys.filter((prefix) => publicKey.startsWith(prefix)),
        value: publicKey,
      });
      let matched = true;
      for (const term of normalized.terms) {
        const fields = ['name', 'display_name', 'nip05'].filter(
          (field) => typeof profile[field] === 'string'
            && profile[field].toLocaleLowerCase().includes(term.toLocaleLowerCase()),
        );
        if (!fields.length) { matched = false; break; }
        matchReasons.push({ type: 'profile-term', term, fields });
      }
      if (matched) results.push(accountResult(publicKey, metadata, matchReasons));
    }
    return {
      query: { publicKeys: normalized.publicKeys, text: normalized.terms, limit: normalized.limit },
      results: cloneJson(results.slice(0, normalized.limit)),
    };
  }

  follows(account) {
    const owner = account && typeof account === 'object'
      ? this.resolve(account) : this.resolve(account, 'account');
    const contact = this.#currentByKey(owner.id, 3);
    if (!contact) return resultCollection([], {
      operation: 'follows', account: owner, currentContactListEventId: null,
      explanation: 'No current stored kind-3 contact list.', relationships: [],
    });
    const traversed = this.traverse([subject('event', contact.event.id)], {
      relationshipTypes: ['follow'], direction: 'outbound', depth: 1, limit: MAX_QUERY_LIMIT,
    });
    return resultCollection(traversed.items.filter(({ subject: item }) => item.type === 'account')
      .map((item) => ({ ...item, provenance: contact.observations })), {
      operation: 'follows', account: owner, currentContactListEventId: contact.event.id,
      relationships: traversed.context.relationships,
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

  thread(eventIdOrPrefix, options = {}) {
    const start = this.resolve(eventIdOrPrefix, 'event');
    const depth = options.depth ?? 10;
    const limit = options.limit ?? DEFAULT_QUERY_LIMIT;
    const descendants = this.traverse([start], {
      relationshipTypes: ['reply-root', 'reply-parent'], direction: 'inbound', depth, limit,
    });
    const ancestors = this.traverse([start], {
      relationshipTypes: ['reply-root', 'reply-parent'], direction: 'outbound', depth, limit,
    });
    const eventSubjects = uniqueSubjects([start, ...descendants.items.map((item) => item.subject),
      ...ancestors.items.map((item) => item.subject)])
      .filter((item) => item.type === 'event' && this.#corpus.records.has(item.id));
    const participants = this.traverse(eventSubjects, {
      relationshipTypes: ['author', 'mentioned-account'], direction: 'outbound', depth: 1, limit,
    });
    const allEdges = [...ancestors.context.relationships, ...descendants.context.relationships];
    const known = (edge) => edge.evidence?.interpretation === 'known';
    return {
      type: 'thread', start,
      collection: resultCollection(uniqueSubjects([
        ...eventSubjects, ...participants.items.map((item) => item.subject)
          .filter(({ type }) => type === 'account'),
      ]).map((item) => ({ subject: item, reasons: [], provenance: [] })), {
        operation: 'thread', relationships: [...allEdges, ...participants.context.relationships],
      }),
      ancestors: allEdges.filter((edge) => known(edge) && edge.direction === 'outbound'),
      directReplies: allEdges.filter((edge) => known(edge)
        && edge.direction === 'inbound' && edge.depth === 1),
      descendants: allEdges.filter((edge) => known(edge)
        && edge.direction === 'inbound' && edge.depth > 1),
      participants: uniqueSubjects(participants.items.map((item) => item.subject)
        .filter(({ type }) => type === 'account')),
      ambiguous: allEdges.filter((edge) => !known(edge)),
    };
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
    const collection = this.traverse([item], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: this.#capacity,
    });
    return { subject: item, resident: collection.context.relationships.length > 0, collection };
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

  deleteSet(id) {
    this.getSet(id);
    this.#sets.delete(id);
    return { id, deleted: true };
  }

  retain(collection, name, options = {}) {
    assertResultCollection(collection);
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
    const collection = coerceCollection(value);
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
        const metadata = mode === 'full' ? this.#currentByKey(reference.id, 0) : null;
        projection = {
          type: 'account', id: reference.id, ...summary,
          ...(metadata ? {
            metadataEvent: metadata.event, observations: metadata.observations,
          } : {}),
        };
      } else if (reference.type === 'set') {
        projection = mode === 'full'
          ? { type: 'set', ...this.getSet(reference.id) }
          : { type: 'set', ...this.#setSummary(this.getSet(reference.id)) };
      } else projection = reference;
      return {
        ...projection, role: item.role ?? 'discovery',
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

  #assertStoredRecord(item, record) {
    const canonical = item.type === 'event' ? this.getEvent(item.id)
      : (() => {
          const metadata = this.#currentByKey(item.id, 0);
          return metadata && {
            profile: parseProfile(metadata.event), metadataEvent: metadata.event,
            observations: metadata.observations,
          };
        })();
    if (!canonical || stableJson(canonical) !== stableJson(record)) {
      throw new ResearchMemoryError(
        'Embedded record must exactly match the canonical record stored in research memory.',
      );
    }
  }

  describe() {
    this.#assertOpen();
    return this.#corpus.describe(this.#capacity, this.#evictions);
  }

  importFixtures(observation) {
    return loadFixtureEvents().map((event) => this.ingest(event, observation));
  }

  reset() {
    this.#assertOpen();
    this.#corpus.clear();
    this.#sets.clear();
    this.#nextObservationId = 1; this.#evictions = 0;
  }

  close() {
    if (!this.#closed) {
      this.reset();
      this.#closed = true;
    }
  }
}

/** Returns a fresh copy of the committed fixture events. */
export function loadFixtureEvents() {
  const fixturePath = new URL('../fixtures/events.json', import.meta.url);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
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

function normalizeAccountQuery(query) {
  assertPlainObject(query, 'Account query');
  rejectUnknownKeys(query, new Set(['publicKeys', 'text', 'limit']), 'account query');
  return {
    publicKeys: normalizeStringList(query.publicKeys, 'publicKeys', true),
    terms: normalizeStringList(query.text, 'text', false) ?? [],
    limit: normalizeLimit(query.limit),
  };
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

function accountResult(publicKey, metadata, matchReasons) {
  return {
    publicKey,
    profile: parseProfile(metadata.event),
    metadataEvent: metadata.event,
    observations: metadata.observations,
    matchReasons,
  };
}

function resultCollection(items, context = {}) {
  return {
    type: 'result-collection',
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
  DEFAULT_ACQUISITION_OBSERVATION_LIMIT,
  DEFAULT_ACQUISITION_DISTINCT_EVENT_LIMIT,
  DEFAULT_ACQUISITION_TIMEOUT_MS,
  DEFAULT_RELAY_CONCURRENCY,
} from './acquire.js';
export { expandResearch } from './expansion.js';
export { resolveReplyContexts } from './reply-contexts.js';
export { createResearchSession, ResearchSession } from './session.js';
