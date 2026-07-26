import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateEvent, verifyEvent } from 'nostr-tools';

const SCHEMA_VERSION = 3;
const EVENT_ID = /^[a-f0-9]{64}$/;
const HEX_PREFIX = /^[a-f0-9]{4,64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;
const DEFAULT_QUERY_LIMIT = 50;
const MAX_QUERY_LIMIT = 1000;
const DEFAULT_ACQUISITION_TIMEOUT_MS = 10_000;
const DEFAULT_ACQUISITION_EVENT_LIMIT = 100;
const DEFAULT_RELAY_CONCURRENCY = 4;
const SUBJECT_TYPES = new Set(['event', 'account', 'tag', 'set', 'run']);
const RETAINABLE_SUBJECT_TYPES = new Set(['event', 'account', 'tag', 'set', 'run']);
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

/**
 * Opens a SQLite-backed research memory at `databasePath`. The file is created
 * when it does not already exist. Call close() when finished.
 */
export function openResearchMemory(databasePath) {
  if (typeof databasePath !== 'string' || databasePath.length === 0) {
    throw new ResearchMemoryError('A non-empty SQLite database path is required.');
  }

  return new ResearchMemory(databasePath);
}

/** Creates a capacity-bounded, process-local research memory. */
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

/**
 * Creates a bounded, disposable in-process corpus attached to durable memory.
 * Call load() to choose the initial stored slice and close() when finished.
 */
export function createResearchWorkspace(memory, options = {}) {
  if (!memory || typeof memory.select !== 'function'
    || typeof memory.getEvent !== 'function' || typeof memory.retain !== 'function') {
    throw new ResearchMemoryError('An open research memory is required.');
  }
  assertPlainObject(options, 'Research workspace options');
  rejectUnknownKeys(options, new Set(['capacity']), 'research workspace option');
  const capacity = options.capacity;
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > MAX_QUERY_LIMIT) {
    throw new ResearchMemoryError(
      `Research workspace capacity must be an integer from 1 to ${MAX_QUERY_LIMIT}.`,
    );
  }
  return new ResearchWorkspace(memory, capacity);
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

export class ResearchMemory {
  #database;
  #closed = false;

  constructor(databasePath) {
    this.databasePath = databasePath;
    this.#database = new DatabaseSync(databasePath);
    this.#database.exec('PRAGMA foreign_keys = ON');
    this.#createSchema();
  }

  #createSchema() {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    const previousVersion = this.#database.prepare(`
      SELECT value FROM schema_metadata WHERE key = 'schema_version'
    `).get()?.value;
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        raw_event TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS observations (
        observation_id INTEGER PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(event_id),
        relay TEXT NOT NULL,
        observed_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS observations_by_event
        ON observations(event_id, observation_id);

      CREATE TABLE IF NOT EXISTS event_relationships (
        source_event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
        relationship_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        evidence TEXT NOT NULL,
        PRIMARY KEY (source_event_id, relationship_type, target_type, target_id, evidence)
      );

      CREATE INDEX IF NOT EXISTS relationships_by_target
        ON event_relationships(target_type, target_id, relationship_type, source_event_id);

      CREATE TABLE IF NOT EXISTS research_runs (
        run_id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        inputs TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        status TEXT NOT NULL,
        diagnostics TEXT NOT NULL,
        results TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS acquisition_attempts (
        attempt_id TEXT PRIMARY KEY,
        filter_json TEXT NOT NULL,
        relays_json TEXT NOT NULL,
        timeout_ms INTEGER NOT NULL,
        event_limit INTEGER NOT NULL,
        concurrency INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        completion_reason TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS acquisition_attempts_by_filter
        ON acquisition_attempts(filter_json, started_at);

      CREATE TABLE IF NOT EXISTS acquisition_relay_outcomes (
        attempt_id TEXT NOT NULL REFERENCES acquisition_attempts(attempt_id) ON DELETE CASCADE,
        relay TEXT NOT NULL,
        contacted INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        received INTEGER NOT NULL,
        invalid INTEGER NOT NULL,
        duplicate INTEGER NOT NULL,
        newly_stored INTEGER NOT NULL,
        observations INTEGER NOT NULL,
        diagnostic TEXT,
        PRIMARY KEY (attempt_id, relay)
      );

      CREATE TABLE IF NOT EXISTS acquisition_observations (
        attempt_id TEXT NOT NULL REFERENCES acquisition_attempts(attempt_id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES events(event_id),
        observation_id INTEGER NOT NULL REFERENCES observations(observation_id),
        observed_at TEXT NOT NULL,
        PRIMARY KEY (attempt_id, observation_id)
      );

      CREATE TABLE IF NOT EXISTS research_sets (
        set_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_set_members (
        set_id TEXT NOT NULL REFERENCES research_sets(set_id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('event', 'account', 'tag', 'set', 'run')),
        entity_id TEXT NOT NULL,
        PRIMARY KEY (set_id, entity_type, entity_id)
      );

      CREATE TABLE IF NOT EXISTS research_set_reasons (
        reason_id INTEGER PRIMARY KEY,
        set_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY (set_id, entity_type, entity_id)
          REFERENCES research_set_members(set_id, entity_type, entity_id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS research_set_reason_identity
        ON research_set_reasons(set_id, entity_type, entity_id, reason);

      CREATE INDEX IF NOT EXISTS events_by_created_at
        ON events(CAST(json_extract(raw_event, '$.created_at') AS INTEGER), event_id);

      CREATE INDEX IF NOT EXISTS events_by_author_kind_created
        ON events(
          json_extract(raw_event, '$.pubkey'),
          CAST(json_extract(raw_event, '$.kind') AS INTEGER),
          CAST(json_extract(raw_event, '$.created_at') AS INTEGER),
          event_id
        );
    `);

    if (previousVersion !== undefined && Number(previousVersion) < 3) {
      this.#rebuildEventRelationships();
    }
    this.#database
      .prepare('INSERT OR REPLACE INTO schema_metadata(key, value) VALUES (?, ?)')
      .run('schema_version', String(SCHEMA_VERSION));
  }

  #rebuildEventRelationships() {
    const events = this.#database
      .prepare('SELECT raw_event FROM events ORDER BY event_id')
      .all()
      .map(({ raw_event: rawEvent }) => JSON.parse(rawEvent));
    const insert = this.#database.prepare(`
      INSERT INTO event_relationships
        (source_event_id, relationship_type, target_type, target_id, evidence)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.#database.exec('BEGIN');
    try {
      this.#database.exec('DELETE FROM event_relationships');
      for (const event of events) {
        for (const relationship of eventRelationships(event)) {
          insert.run(
            event.id, relationship.type, relationship.targetType,
            relationship.targetId, stableJson(relationship.evidence),
          );
        }
      }
      this.#database.exec('COMMIT');
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }

  #assertOpen() {
    if (this.#closed) {
      throw new ResearchMemoryError('This research memory has already been closed.');
    }
  }

  /** Deliberately discards all local evidence and observations in this database. */
  reset() {
    this.#assertOpen();
    this.#database.exec(`
      DROP TABLE IF EXISTS acquisition_observations;
      DROP TABLE IF EXISTS acquisition_relay_outcomes;
      DROP TABLE IF EXISTS acquisition_attempts;
      DROP TABLE IF EXISTS observations;
      DROP TABLE IF EXISTS event_relationships;
      DROP TABLE IF EXISTS research_set_reasons;
      DROP TABLE IF EXISTS research_set_members;
      DROP TABLE IF EXISTS research_sets;
      DROP TABLE IF EXISTS research_runs;
      DROP TABLE IF EXISTS events;
      DROP TABLE IF EXISTS schema_metadata;
    `);
    this.#createSchema();
  }

  /**
   * Stores a canonical event once and records this acquisition observation.
   * Repeated encounters always add an observation, even when the event is
   * already present.
   */
  ingest(event, observation) {
    this.#assertOpen();
    assertCanonicalEvent(event);
    const normalizedObservation = normalizeObservation(observation);
    const rawEvent = JSON.stringify(event);

    this.#database.exec('BEGIN');
    try {
      const inserted = this.#database
        .prepare('INSERT OR IGNORE INTO events(event_id, raw_event) VALUES (?, ?)')
        .run(event.id, rawEvent);
      if (inserted.changes === 1) {
        const insertRelationship = this.#database.prepare(`
          INSERT INTO event_relationships
            (source_event_id, relationship_type, target_type, target_id, evidence)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const relationship of eventRelationships(event)) {
          insertRelationship.run(
            event.id, relationship.type, relationship.targetType,
            relationship.targetId, stableJson(relationship.evidence),
          );
        }
      }
      const observationResult = this.#database
        .prepare('INSERT INTO observations(event_id, relay, observed_at) VALUES (?, ?, ?)')
        .run(event.id, normalizedObservation.relay, normalizedObservation.observedAt);
      this.#database.exec('COMMIT');

      return {
        eventId: event.id,
        eventStored: inserted.changes === 1,
        observation: {
          id: Number(observationResult.lastInsertRowid),
          ...normalizedObservation,
        },
      };
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }

  /** Returns immutable stored evidence together with all observed provenance. */
  getEvent(eventId) {
    this.#assertOpen();
    if (typeof eventId !== 'string' || !EVENT_ID.test(eventId)) {
      throw new ResearchMemoryError('Event ID must be a 64-character lowercase hexadecimal string.');
    }

    const record = this.#database
      .prepare('SELECT raw_event FROM events WHERE event_id = ?')
      .get(eventId);
    if (!record) return null;

    const observations = this.#database
      .prepare(
        'SELECT observation_id, relay, observed_at FROM observations WHERE event_id = ? ORDER BY observation_id',
      )
      .all(eventId)
      .map((row) => ({
        id: Number(row.observation_id),
        relay: row.relay,
        observedAt: row.observed_at,
      }));

    return {
      event: JSON.parse(record.raw_event),
      observations,
    };
  }

  /**
   * Searches only accumulated local evidence. Different constraint fields are
   * ANDed, values within one field are ORed, and every submitted text term
   * must occur (case-insensitively) in event content.
   */
  searchEvents(query = {}) {
    this.#assertOpen();
    const normalized = normalizeEventQuery(query);
    const ids = resolveStoredPrefixes(this.#database, normalized.ids, 'event_id', 'event ID');
    const authors = resolveStoredPrefixes(
      this.#database, normalized.authors,
      "json_extract(raw_event, '$.pubkey')", 'author public key',
    );
    const events = selectedEventRecords(this.#database, normalized, ids, authors);

    const matches = [];
    for (const record of events) {
      const reasons = matchEvent(record.event, normalized, ids, authors);
      if (reasons) matches.push({ ...record, matchReasons: reasons });
    }
    return {
      query: publicEventQuery(normalized),
      results: matches,
    };
  }

  /**
   * Selects accumulated local evidence and returns a reusable result collection.
   * This is local-only; it never contacts relays.
   */
  select(query = {}) {
    const outcome = this.searchEvents(query);
    return resultCollection(
      outcome.results.map(({ event, observations, matchReasons }) => ({
        subject: subject('event', event.id),
        record: { event, observations },
        reasons: matchReasons,
        provenance: observations,
      })),
      { operation: 'selection', query: outcome.query },
    );
  }

  /** Adapts public acquisition, search, account, or navigation output for composition. */
  asCollection(value) {
    this.#assertOpen();
    if (value?.type === 'result-collection') {
      assertResultCollection(value);
      return value;
    }
    if (value?.collection?.type === 'result-collection') {
      assertResultCollection(value.collection);
      return value.collection;
    }
    if (Array.isArray(value?.acquiredObservations)) {
      return resultCollection(value.acquiredObservations.map(({ eventId, observations }) => ({
        subject: subject('event', eventId),
        reasons: [{ type: 'acquisition', requested: value.requested }],
        provenance: observations,
      })), { operation: 'acquisition', completionReason: value.completionReason });
    }
    if (Array.isArray(value?.results)) {
      return resultCollection(value.results.map((item) => {
        if (item.event) {
          return {
            subject: subject('event', item.event.id),
            record: { event: item.event, observations: item.observations ?? [] },
            reasons: item.matchReasons ?? [],
            provenance: item.observations ?? [],
          };
        }
        if (item.publicKey) {
          return {
            subject: subject('account', item.publicKey),
            record: {
              profile: item.profile,
              metadataEvent: item.metadataEvent,
              observations: item.observations ?? [],
            },
            reasons: item.matchReasons ?? [],
            provenance: item.observations ?? [],
          };
        }
        throw new ResearchMemoryError('Unsupported public result shape.');
      }), { operation: 'adapted-results', query: value.query });
    }
    throw new ResearchMemoryError('Unsupported public result shape.');
  }

  /** Constructs a normalized reusable collection without accepting invented evidence records. */
  collection(items, context = {}) {
    this.#assertOpen();
    if (!Array.isArray(items)) {
      throw new ResearchMemoryError('Collection items must be an array.');
    }
    assertPlainObject(context, 'Collection context');
    const normalized = items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new ResearchMemoryError('Each collection item must be a result item.');
      }
      if (item.role !== undefined && !['seed', 'discovery'].includes(item.role)) {
        throw new ResearchMemoryError('Collection item role must be "seed" or "discovery".');
      }
      if (item.reasons !== undefined && !Array.isArray(item.reasons)) {
        throw new ResearchMemoryError('Collection item reasons must be an array.');
      }
      if (item.provenance !== undefined && !Array.isArray(item.provenance)) {
        throw new ResearchMemoryError('Collection item provenance must be an array.');
      }
      const normalizedSubject = normalizeSubject(item.subject);
      if (item.record !== undefined) {
        this.#assertStoredRecord(normalizedSubject, item.record);
      }
      return { ...item, subject: normalizedSubject };
    });
    return resultCollection(normalized, context);
  }

  /**
   * Resolves an addressable local subject. Accounts additionally resolve by
   * stored name, display name, NIP-05, full key, or unambiguous key prefix.
   */
  resolve(reference, type) {
    this.#assertOpen();
    if (type !== undefined) {
      if (!SUBJECT_TYPES.has(type) || typeof reference !== 'string' || reference.length === 0) {
        throw new ResearchMemoryError('A valid subject type and non-empty identifier are required.');
      }
      return this.#resolveTypedSubject({ type, id: reference });
    }
    if (reference && typeof reference === 'object') {
      return this.#resolveTypedSubject(normalizeSubject(reference));
    }
    if (typeof reference !== 'string' || reference.length === 0) {
      throw new ResearchMemoryError('A subject reference or non-empty account identifier is required.');
    }
    return this.#resolveAccountSubject(reference);
  }

  #resolveTypedSubject(reference) {
    if (reference.type === 'event') {
      return subject('event', resolveStoredPrefix(
        this.#database, reference.id, 'event_id', 'event ID',
      ));
    }
    if (reference.type === 'account') return this.#resolveAccountSubject(reference.id);
    if (reference.type === 'set') {
      return subject('set', this.getSet(reference.id).id);
    }
    if (reference.type === 'run') {
      return subject('run', this.getRun(reference.id).id);
    }
    return subject(reference.type, reference.id);
  }

  #resolveAccountSubject(identifier) {
    const keys = this.#database.prepare(`
      SELECT DISTINCT value FROM (
        SELECT json_extract(raw_event, '$.pubkey') AS value FROM events
        UNION ALL
        SELECT json_extract(tag.value, '$[1]') AS value
        FROM events, json_each(json_extract(raw_event, '$.tags')) AS tag
        WHERE json_extract(tag.value, '$[0]') IN ('p', 'P')
      ) WHERE length(value) = 64
      ORDER BY value
    `).all().map(({ value }) => value);
    if (HEX_PREFIX.test(identifier)) {
      return subject('account', resolveOnePrefix(identifier, keys, 'account public key'));
    }
    const normalized = identifier.toLocaleLowerCase();
    const matches = [];
    for (const key of keys) {
      const metadata = currentAccountMetadata(this.#database, key);
      if (!metadata) continue;
      const profile = parseProfile(metadata.event);
      if (['name', 'display_name', 'nip05'].some(
        (field) => typeof profile[field] === 'string'
          && profile[field].toLocaleLowerCase() === normalized,
      )) matches.push(key);
    }
    if (matches.length === 0) {
      throw new ResearchMemoryError(`No stored account matches ${identifier}.`);
    }
    if (matches.length > 1) {
      throw new ResearchMemoryError(`Ambiguous stored account identifier ${identifier}: ${matches.length} accounts match.`);
    }
    return subject('account', matches[0]);
  }

  /** Resolves the current stored kind-0 metadata event for one public key. */
  resolveAccount(publicKeyOrPrefix) {
    this.#assertOpen();
    const publicKey = resolveStoredPrefix(
      this.#database, publicKeyOrPrefix,
      "json_extract(raw_event, '$.pubkey')", 'account public key',
    );
    const metadata = currentAccountMetadata(this.#database, publicKey);
    if (!metadata) {
      throw new ResearchMemoryError(`No stored kind-0 metadata event found for account ${publicKey}.`);
    }
    return accountResult(publicKey, metadata, [{ type: 'public-key', value: publicKey }]);
  }

  /**
   * Returns the current locally stored event for one replaceable address, or
   * null when that address is absent. Selection is local-only and preserves
   * direct access to every historical event through getEvent().
   */
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
      ? this.resolve(account)
      : this.resolve(account, 'account');
    let identifier;
    if (kind >= 30000 && kind < 40000) {
      identifier = options.d ?? '';
      if (typeof identifier !== 'string') {
        throw new ResearchMemoryError('Current event d must be a string.');
      }
    } else if (options.d !== undefined) {
      throw new ResearchMemoryError('Current event d applies only to kinds 30000-39999.');
    }
    return currentReplaceableEvent(this.#database, owner.id, kind, identifier);
  }

  /**
   * Selects accounts named by the current stored kind-3 contact list.
   * A follow is attributed tag evidence, not endorsement or reciprocity.
   */
  follows(account) {
    this.#assertOpen();
    const owner = account && typeof account === 'object'
      ? this.resolve(account)
      : this.resolve(account, 'account');
    const contactList = currentReplaceableEvent(this.#database, owner.id, 3);
    if (!contactList) {
      return resultCollection([], {
        operation: 'follows',
        account: owner,
        currentContactListEventId: null,
        explanation: 'No current stored kind-3 contact list.',
        relationships: [],
      });
    }
    const traversed = this.traverse([subject('event', contactList.event.id)], {
      relationshipTypes: ['follow'],
      direction: 'outbound',
      depth: 1,
      limit: MAX_QUERY_LIMIT,
    });
    return resultCollection(
      traversed.items
        .filter((item) => item.subject.type === 'account')
        .map((item) => ({
          ...item,
          provenance: contactList.observations,
        })),
      {
        operation: 'follows',
        account: owner,
        currentContactListEventId: contactList.event.id,
        relationships: traversed.context.relationships,
      },
    );
  }

  /** Searches current stored account metadata, never relays or identity services. */
  searchAccounts(query = {}) {
    this.#assertOpen();
    const normalized = normalizeAccountQuery(query);
    const authors = this.#database.prepare(`
      SELECT DISTINCT json_extract(raw_event, '$.pubkey') AS public_key FROM events
      WHERE CAST(json_extract(raw_event, '$.kind') AS INTEGER) = 0
      ORDER BY public_key
    `).all().map(({ public_key: publicKey }) => publicKey);

    const results = [];
    for (const publicKey of authors) {
      if (normalized.publicKeys && !normalized.publicKeys.some((prefix) => publicKey.startsWith(prefix))) continue;
      const metadata = currentReplaceableEvent(this.#database, publicKey, 0);
      const profile = parseProfile(metadata.event);
      const reasons = [];
      if (normalized.publicKeys) {
        reasons.push({
          type: 'public-key-prefix',
          prefixes: normalized.publicKeys.filter((prefix) => publicKey.startsWith(prefix)),
          value: publicKey,
        });
      }
      let termsMatch = true;
      for (const term of normalized.terms) {
        const fields = ['name', 'display_name', 'nip05'].filter(
          (field) => typeof profile[field] === 'string'
            && profile[field].toLocaleLowerCase().includes(term.toLocaleLowerCase()),
        );
        if (fields.length === 0) {
          termsMatch = false;
          break;
        }
        reasons.push({ type: 'profile-term', term, fields });
      }
      if (termsMatch) results.push(accountResult(publicKey, metadata, reasons));
    }
    results.sort((left, right) => left.publicKey.localeCompare(right.publicKey));
    return {
      query: { publicKeys: normalized.publicKeys, text: normalized.terms, limit: normalized.limit },
      results: results.slice(0, normalized.limit),
    };
  }

  /** Returns evidence-backed outbound and inbound relationships for an event. */
  relatedEvent(eventIdOrPrefix) {
    const resolved = this.resolve(eventIdOrPrefix, 'event');
    return navigationFromTraversal(this, this.traverse([resolved], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: MAX_QUERY_LIMIT,
    }));
  }

  /** Returns authored events and stored references to an account. */
  relatedAccount(publicKeyOrPrefix) {
    const resolved = this.resolve(publicKeyOrPrefix, 'account');
    return navigationFromTraversal(this, this.traverse([resolved], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: MAX_QUERY_LIMIT,
    }));
  }

  /**
   * Traverses evidence-derived relationships using deterministic breadth-first
   * order. Subjects are deduplicated while every distinct explaining edge is
   * retained.
   */
  traverse(starting, options = {}) {
    this.#assertOpen();
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
    const limit = normalizeLimit(options.limit);
    const starts = expandStartingSubjects(this, starting).map((item) => this.#resolveTypedSubject(item));
    const queue = starts.map((item) => ({ subject: item, depth: 0 }));
    const visited = new Map(starts.map((item) => [memberKey(item), {
      subject: item, role: 'seed', reasons: [{ type: 'traversal-start' }], provenance: [],
    }]));
    const relationships = [];
    const edgeKeys = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.depth >= depth) continue;
      for (const relation of relationshipsForSubject(
        this.#database, current.subject.type, current.subject.id,
      )) {
        if (!relationshipTypes.includes(relation.type)) continue;
        if (direction !== 'both' && relation.direction !== direction) continue;
        const next = relation.direction === 'outbound'
          ? subject(relation.target.type, relation.target.id)
          : subject('event', relation.sourceEventId);
        const stepDepth = current.depth + 1;
        const edge = {
          source: current.subject,
          target: next,
          direction: relation.direction,
          type: relation.type,
          depth: stepDepth,
          sourceEventId: relation.sourceEventId,
          evidence: relation.evidence,
        };
        const edgeKey = stableJson(edge);
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          relationships.push(edge);
        }
        const key = memberKey(next);
        if (!visited.has(key) && visited.size - starts.length < limit) {
          visited.set(key, {
            subject: next, role: 'discovery',
            reasons: [{
              type: 'relationship', relationshipType: relation.type,
              direction: relation.direction, depth: stepDepth,
              source: current.subject, sourceEventId: relation.sourceEventId,
              evidence: relation.evidence,
            }],
            provenance: [{ type: 'stored-event-observations', eventId: relation.sourceEventId }],
          });
          queue.push({ subject: next, depth: stepDepth });
        } else if (visited.has(key)) {
          const item = visited.get(key);
          const reason = {
            type: 'relationship', relationshipType: relation.type,
            direction: relation.direction, depth: stepDepth,
            source: current.subject, sourceEventId: relation.sourceEventId,
            evidence: relation.evidence,
          };
          if (!item.reasons.some((existing) => stableJson(existing) === stableJson(reason))) {
            item.reasons.push(reason);
          }
        }
      }
    }
    relationships.sort(compareTraversalEdges);
    return resultCollection([...visited.values()], {
      operation: 'traversal', starts, relationshipTypes, direction, depth, limit,
      relationships,
    });
  }

  /**
   * Atomically records one bounded relay attempt. Coverage is evidence of an
   * attempt and its observations, never a completeness claim.
   */
  recordAcquisitionCoverage(result) {
    this.#assertOpen();
    const normalized = normalizeAcquisitionCoverage(result);
    const attemptId = randomUUID();
    const insertAttempt = this.#database.prepare(`
      INSERT INTO acquisition_attempts
        (attempt_id, filter_json, relays_json, timeout_ms, event_limit, concurrency,
         started_at, finished_at, completion_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertRelay = this.#database.prepare(`
      INSERT INTO acquisition_relay_outcomes
        (attempt_id, relay, contacted, outcome, received, invalid, duplicate, newly_stored,
         observations, diagnostic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertObservation = this.#database.prepare(`
      INSERT INTO acquisition_observations
        (attempt_id, event_id, observation_id, observed_at)
      VALUES (?, ?, ?, ?)
    `);
    this.#database.exec('BEGIN');
    try {
      insertAttempt.run(
        attemptId, stableJson(normalized.requested.filter),
        stableJson([...normalized.requested.relays].sort()), normalized.budget.timeoutMs,
        normalized.budget.eventLimit, normalized.budget.concurrency,
        normalized.startedAt, normalized.finishedAt, normalized.completionReason,
      );
      for (const relay of normalized.relays) {
        insertRelay.run(
          attemptId, relay.relay, relay.contacted ? 1 : 0, relay.outcome, relay.received, relay.invalid,
          relay.duplicate, relay.newlyStored, relay.observations, relay.diagnostic,
        );
      }
      for (const observed of normalized.acquiredObservations) {
        for (const observation of observed.observations) {
          const stored = this.#database.prepare(`
            SELECT event_id, observed_at FROM observations WHERE observation_id = ?
          `).get(observation.id);
          if (!stored || stored.event_id !== observed.eventId
              || stored.observed_at !== observation.observedAt) {
            throw new ResearchMemoryError(
              'Acquisition coverage observations must reference matching stored observations.',
            );
          }
          insertObservation.run(
            attemptId, observed.eventId, observation.id, observation.observedAt,
          );
        }
      }
      this.#database.exec('COMMIT');
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
    return this.getAcquisitionCoverage(attemptId);
  }

  getAcquisitionCoverage(attemptId) {
    this.#assertOpen();
    const row = this.#database.prepare(
      'SELECT * FROM acquisition_attempts WHERE attempt_id = ?',
    ).get(attemptId);
    if (!row) throw new ResearchMemoryError(`No acquisition coverage found for ID ${attemptId}.`);
    return publicAcquisitionCoverage(this.#database, row);
  }

  listAcquisitionCoverage() {
    this.#assertOpen();
    return this.#database.prepare(`
      SELECT * FROM acquisition_attempts ORDER BY started_at, attempt_id
    `).all().map((row) => publicAcquisitionCoverage(this.#database, row));
  }

  /**
   * Answers whether this exact relay/filter slice was attempted. A true result
   * reports attempts only; it does not assert exhaustive relay coverage.
   */
  acquisitionCoverage(request) {
    this.#assertOpen();
    assertPlainObject(request, 'Acquisition coverage request');
    rejectUnknownKeys(request, new Set(['relays', 'filter']), 'coverage request field');
    if (!Array.isArray(request.relays) || request.relays.length === 0
        || request.relays.some((relay) => typeof relay !== 'string' || relay.length === 0)) {
      throw new ResearchMemoryError('Coverage requires explicit relay URLs.');
    }
    assertPlainObject(request.filter, 'Coverage NIP-01 filter');
    const filterJson = stableJson(request.filter);
    const relaysJson = stableJson([...request.relays].sort());
    const rows = this.#database.prepare(`
      SELECT * FROM acquisition_attempts
      WHERE filter_json = ? AND relays_json = ?
      ORDER BY started_at, attempt_id
    `).all(filterJson, relaysJson);
    return {
      attempted: rows.length > 0,
      exhaustive: false,
      uncertainty: 'Coverage records bounded attempts and observations, not an exhaustive relay index.',
      request: cloneJson(request),
      attempts: rows.map((row) => publicAcquisitionCoverage(this.#database, row)),
    };
  }

  /** Persists an immutable public account of one completed research operation. */
  recordRun(run) {
    this.#assertOpen();
    const normalized = normalizeRun(run);
    const runId = randomUUID();
    this.#database.prepare(`
      INSERT INTO research_runs
        (run_id, operation, inputs, started_at, finished_at, status, diagnostics, results)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId, normalized.operation, stableJson(normalized.inputs),
      normalized.startedAt, normalized.finishedAt, normalized.status,
      stableJson(normalized.diagnostics), stableJson(normalized.results),
    );
    return this.getRun(runId);
  }

  listRuns() {
    this.#assertOpen();
    return this.#database.prepare(`
      SELECT run_id, operation, inputs, started_at, finished_at, status,
        json_array_length(diagnostics) AS diagnostic_count,
        json_array_length(results) AS result_count
      FROM research_runs
      ORDER BY started_at, run_id
    `).all().map(publicRunSummary);
  }

  getRun(runId) {
    this.#assertOpen();
    const row = this.#database.prepare('SELECT * FROM research_runs WHERE run_id = ?').get(runId);
    if (!row) throw new ResearchMemoryError(`No research run found for ID ${runId}.`);
    return publicRun(row);
  }

  createSet(name) {
    this.#assertOpen();
    const setId = randomUUID();
    this.#database.prepare(
      'INSERT INTO research_sets(set_id, name, created_at) VALUES (?, ?, ?)',
    ).run(setId, normalizeSetName(name), new Date().toISOString());
    return this.getSet(setId);
  }

  listSets() {
    this.#assertOpen();
    const summaries = this.#database.prepare(`
      SELECT s.set_id, s.name, s.created_at,
        COUNT(DISTINCT m.entity_type || ':' || m.entity_id) AS member_count,
        COUNT(DISTINCT r.reason_id) AS reason_count,
        COUNT(DISTINCT CASE WHEN m.entity_type = 'event' THEN m.entity_id END) AS event_count,
        COUNT(DISTINCT CASE WHEN m.entity_type = 'account' THEN m.entity_id END) AS account_count,
        COUNT(DISTINCT CASE WHEN m.entity_type = 'tag' THEN m.entity_id END) AS tag_count,
        COUNT(DISTINCT CASE WHEN m.entity_type = 'set' THEN m.entity_id END) AS set_count,
        COUNT(DISTINCT CASE WHEN m.entity_type = 'run' THEN m.entity_id END) AS run_count
      FROM research_sets AS s
      LEFT JOIN research_set_members AS m ON m.set_id = s.set_id
      LEFT JOIN research_set_reasons AS r ON r.set_id = s.set_id
        AND r.entity_type = m.entity_type AND r.entity_id = m.entity_id
      GROUP BY s.set_id
      ORDER BY s.name, s.set_id
    `).all().map(publicSetSummary);
    const preview = this.#database.prepare(`
      SELECT entity_type AS type, entity_id AS id
      FROM research_set_members
      WHERE set_id = ?
      ORDER BY entity_type, entity_id
      LIMIT 5
    `);
    return summaries.map((set) => ({ ...set, preview: preview.all(set.id) }));
  }

  getSet(setId) {
    this.#assertOpen();
    const row = this.#database.prepare('SELECT * FROM research_sets WHERE set_id = ?').get(setId);
    if (!row) throw new ResearchMemoryError(`No research set found for ID ${setId}.`);
    const members = [];
    for (const reasonRow of this.#database.prepare(`
      SELECT m.entity_type, m.entity_id, r.reason
      FROM research_set_members AS m
      LEFT JOIN research_set_reasons AS r
        ON r.set_id = m.set_id
        AND r.entity_type = m.entity_type
        AND r.entity_id = m.entity_id
      WHERE m.set_id = ?
      ORDER BY m.entity_type, m.entity_id, r.reason_id
    `).all(setId)) {
      const previous = members.at(-1);
      const member = previous?.type === reasonRow.entity_type
        && previous.id === reasonRow.entity_id
        ? previous
        : (() => {
            const created = {
              type: reasonRow.entity_type, id: reasonRow.entity_id, reasons: [],
            };
            members.push(created);
            return created;
          })();
      if (reasonRow.reason !== null) member.reasons.push(JSON.parse(reasonRow.reason));
    }
    return { id: row.set_id, name: row.name, createdAt: row.created_at, members };
  }

  #createPopulatedSet(name, entries, options = {}) {
    const normalizedName = normalizeSetName(name);
    const deduplicated = new Map();
    for (const entry of entries) {
      const member = normalizeMember(entry.member);
      const key = memberKey(member);
      const stored = deduplicated.get(key) ?? { member, reasons: new Map() };
      for (const reason of entry.reasons) {
        const encoded = stableJson(normalizeReason(reason));
        stored.reasons.set(encoded, encoded);
      }
      deduplicated.set(key, stored);
    }

    const setId = randomUUID();
    const createdAt = new Date().toISOString();
    const insertSet = this.#database.prepare(
      'INSERT INTO research_sets(set_id, name, created_at) VALUES (?, ?, ?)',
    );
    const insertMember = this.#database.prepare(`
      INSERT INTO research_set_members(set_id, entity_type, entity_id) VALUES (?, ?, ?)
    `);
    const insertReason = this.#database.prepare(`
      INSERT INTO research_set_reasons(set_id, entity_type, entity_id, reason)
      VALUES (?, ?, ?, ?)
    `);
    let reasonCount = 0;
    this.#database.exec('BEGIN');
    try {
      insertSet.run(setId, normalizedName, createdAt);
      for (const { member, reasons } of deduplicated.values()) {
        if (options.signal?.aborted) {
          throw new ResearchMemoryError('Populated set creation was interrupted.');
        }
        insertMember.run(setId, member.type, member.id);
        for (const encoded of reasons.values()) {
          insertReason.run(setId, member.type, member.id, encoded);
          reasonCount += 1;
        }
      }
      this.#database.exec('COMMIT');
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
    return {
      id: setId,
      name: normalizedName,
      createdAt,
      memberCount: deduplicated.size,
      reasonCount,
      preview: [...deduplicated.values()].slice(0, 10).map(({ member }) => member),
    };
  }

  renameSet(setId, name) {
    this.#assertOpen();
    assertSetExists(this.#database, setId);
    this.#database.prepare('UPDATE research_sets SET name = ? WHERE set_id = ?')
      .run(normalizeSetName(name), setId);
    return this.getSet(setId);
  }

  deleteSet(setId) {
    this.#assertOpen();
    assertSetExists(this.#database, setId);
    this.#database.prepare('DELETE FROM research_sets WHERE set_id = ?').run(setId);
    return { id: setId, deleted: true };
  }

  addSetMember(setId, member, reason = { type: 'explicit' }) {
    this.#assertOpen();
    assertSetExists(this.#database, setId);
    const normalizedMember = normalizeMember(member);
    const normalizedReason = normalizeReason(reason);
    this.#database.exec('BEGIN');
    try {
      this.#database.prepare(`
        INSERT OR IGNORE INTO research_set_members(set_id, entity_type, entity_id)
        VALUES (?, ?, ?)
      `).run(setId, normalizedMember.type, normalizedMember.id);
      const encoded = stableJson(normalizedReason);
      const duplicate = this.#database.prepare(`
        SELECT 1 FROM research_set_reasons
        WHERE set_id = ? AND entity_type = ? AND entity_id = ? AND reason = ?
      `).get(setId, normalizedMember.type, normalizedMember.id, encoded);
      if (!duplicate) this.#database.prepare(`
        INSERT INTO research_set_reasons(set_id, entity_type, entity_id, reason)
        VALUES (?, ?, ?, ?)
      `).run(setId, normalizedMember.type, normalizedMember.id, encoded);
      this.#database.exec('COMMIT');
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
    return this.explainSetMember(setId, normalizedMember);
  }

  removeSetMember(setId, member) {
    this.#assertOpen();
    assertSetExists(this.#database, setId);
    const normalized = normalizeMember(member);
    const result = this.#database.prepare(`
      DELETE FROM research_set_members WHERE set_id = ? AND entity_type = ? AND entity_id = ?
    `).run(setId, normalized.type, normalized.id);
    return { ...normalized, removed: result.changes === 1 };
  }

  explainSetMember(setId, member) {
    const normalized = normalizeMember(member);
    const set = this.getSet(setId);
    const found = set.members.find(
      ({ type, id }) => type === normalized.type && id === normalized.id,
    );
    if (!found) {
      throw new ResearchMemoryError(
        `Research set ${setId} has no ${normalized.type} member ${normalized.id}.`,
      );
    }
    return { set: { id: set.id, name: set.name }, member: found };
  }

  createSetFromRun(name, runId) {
    this.#assertOpen();
    const run = this.getRun(runId);
    return this.#createPopulatedSet(name, run.results.map((result) => ({
      member: result,
      reasons: [{
        type: 'run',
        runId,
        operation: run.operation,
        matchReasons: result.reasons,
        provenance: result.provenance,
      }],
    })));
  }

  expandSet(sourceSetId, name, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'Expansion options');
    rejectUnknownKeys(options, new Set(['relationshipTypes', 'direction', 'limit']), 'expansion option');
    const types = normalizeStringList(options.relationshipTypes, 'relationshipTypes', false);
    if (!types) throw new ResearchMemoryError('Expansion relationshipTypes are required.');
    const unsupportedTypes = types.filter((type) => !NAVIGATION_RELATIONSHIP_TYPES.has(type));
    if (unsupportedTypes.length > 0) {
      throw new ResearchMemoryError(
        `Unsupported expansion relationship type${unsupportedTypes.length === 1 ? '' : 's'}: ${unsupportedTypes.join(', ')}.`,
      );
    }
    const direction = options.direction ?? 'outbound';
    if (!['outbound', 'inbound', 'both'].includes(direction)) {
      throw new ResearchMemoryError('Expansion direction must be "outbound", "inbound", or "both".');
    }
    const limit = normalizeLimit(options.limit);
    const traversal = this.traverse([subject('set', sourceSetId)], {
      relationshipTypes: types, direction, depth: 1, limit,
    });
    const starts = new Set(traversal.context.starts.map(memberKey));
    return this.retain({
      ...traversal,
      items: traversal.items.filter(({ subject: item }) => !starts.has(memberKey(item))),
    }, name, { reason: { type: 'set-expansion', sourceSetId } });
  }

  /** Retains a reusable result collection as a durable research set. */
  retain(collection, name, options = {}) {
    this.#assertOpen();
    assertResultCollection(collection);
    assertPlainObject(options, 'Retention options');
    rejectUnknownKeys(options, new Set(['reason', 'signal']), 'retention option');
    if (options.signal !== undefined
      && (!options.signal || typeof options.signal !== 'object'
        || typeof options.signal.aborted !== 'boolean')) {
      throw new ResearchMemoryError('Retention signal must be an AbortSignal.');
    }
    const retentionContext = options.reason ? normalizeReason(options.reason) : undefined;
    return this.#createPopulatedSet(name, collection.items
      .filter((item) => RETAINABLE_SUBJECT_TYPES.has(item.subject.type))
      .map((item) => ({
        member: item.subject,
        reasons: (item.reasons.length ? item.reasons : [{ type: 'retained-result' }]).map(
          (reason) => ({
          ...reason,
          ...(retentionContext ? { retentionContext } : {}),
          operation: collection.context.operation,
          provenance: retainedProvenance(item),
          }),
        ),
      })), { signal: options.signal });
  }

  /**
   * Projects subjects or reusable results without changing canonical evidence.
   * Modes are compact, full, ids, and ndjson.
   */
  project(value, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'Projection options');
    rejectUnknownKeys(options, new Set(['mode', 'excerptLimit', 'previewLimit']), 'projection option');
    const mode = options.mode ?? 'compact';
    if (!['compact', 'full', 'ids', 'ndjson'].includes(mode)) {
      throw new ResearchMemoryError('Projection mode must be compact, full, ids, or ndjson.');
    }
    const excerptLimit = normalizeProjectionLimit(options.excerptLimit, 160, 'excerptLimit');
    const previewLimit = normalizeProjectionLimit(options.previewLimit, 5, 'previewLimit');
    const collection = coerceCollection(value);
    const projected = collection.items.map((item) => (
      this.#projectSubject(item.subject, mode, excerptLimit, previewLimit)
    ));
    if (mode === 'ids') return projected;
    const relationshipSubjects = uniqueSubjects((collection.context.relationships ?? [])
      .flatMap((edge) => [edge.source, edge.target]));
    const subjectSummaries = mode === 'compact' || mode === 'ndjson'
      ? relationshipSubjects.map((item) => (
          this.#projectSubject(item, 'compact', excerptLimit, previewLimit)
        ))
      : [];
    const relationships = (collection.context.relationships ?? []).map((edge) => ({
      ...edge,
      sourceRef: memberKey(edge.source),
      targetRef: memberKey(edge.target),
      interpretation: edge.evidence?.interpretation,
    }));
    const output = {
      type: 'result-collection',
      context: cloneJson(collection.context),
      results: projected.map((projection, index) => ({
        ...projection,
        role: collection.items[index].role ?? 'discovery',
        reasons: cloneJson(collection.items[index].reasons),
        provenance: cloneJson(collection.items[index].provenance),
      })),
      ...(subjectSummaries.length ? {
        subjects: Object.fromEntries(subjectSummaries.map((summary) => [
          memberKey(summary), summary,
        ])),
      } : {}),
      ...(relationships.length ? { relationships } : {}),
    };
    if (mode === 'ndjson') {
      return [
        { type: 'collection', context: output.context, resultCount: output.results.length },
        ...output.results,
        ...relationships.map((relationship) => ({ recordType: 'relationship', ...relationship })),
      ];
    }
    return output;
  }

  #projectSubject(reference, mode, excerptLimit, previewLimit) {
    const item = normalizeSubject(reference);
    if (mode === 'ids') return { type: item.type, id: item.id };
    if (item.type === 'event') {
      const record = this.getEvent(item.id);
      if (!record) return { type: 'event', id: item.id, resolved: false };
      if (mode === 'full') return { type: 'event', id: item.id, ...record };
      const account = accountSummaryForKey(this.#database, record.event.pubkey, excerptLimit);
      const relays = distinctRelays(record.observations);
      return {
        type: 'event', id: item.id, kind: record.event.kind,
        author: account, createdAt: record.event.created_at,
        contentExcerpt: excerpt(record.event.content, excerptLimit),
        relayCount: relays.length, relays,
      };
    }
    if (item.type === 'account') {
      const summary = accountSummaryForKey(this.#database, item.id, excerptLimit);
      if (mode === 'full') {
        const metadata = currentAccountMetadata(this.#database, item.id);
        return { type: 'account', id: item.id, ...summary, ...(metadata ? {
          metadataEvent: metadata.event, observations: metadata.observations,
        } : {}) };
      }
      return { type: 'account', id: item.id, ...summary };
    }
    if (item.type === 'set') {
      if (mode === 'full') return { type: 'set', ...this.getSet(item.id) };
      const set = compactSetRecord(this.#database, item.id, previewLimit);
      return {
        type: 'set', id: set.id, name: set.name, createdAt: set.createdAt,
        memberCount: set.memberCount, counts: set.counts,
        preview: set.preview.map(
          (member) => this.#projectSubject(member, 'compact', excerptLimit, previewLimit),
        ),
      };
    }
    if (item.type === 'run') {
      if (mode === 'full') return { type: 'run', ...this.getRun(item.id) };
      const run = compactRunRecord(this.#database, item.id, previewLimit);
      return {
        type: 'run', id: run.id, operation: run.operation, status: run.status,
        startedAt: run.startedAt, finishedAt: run.finishedAt, inputs: run.inputs,
        outcomeCounts: run.operation === 'acquisition'
          ? run.outcomeCounts
          : { results: run.resultCount, diagnostics: run.diagnosticCount },
        preview: run.preview.map(
          (result) => this.#projectSubject(result, 'compact', excerptLimit, previewLimit),
        ),
      };
    }
    return { type: 'tag', id: item.id };
  }

  /**
   * Composes shared traversal operations into a conversation-oriented view.
   */
  thread(eventIdOrPrefix, options = {}) {
    const start = this.resolve(eventIdOrPrefix, 'event');
    const depth = options.depth ?? 10;
    const limit = options.limit ?? DEFAULT_QUERY_LIMIT;
    const descendants = this.traverse([start], {
      relationshipTypes: ['reply-root', 'reply-parent'],
      direction: 'inbound', depth, limit,
    });
    const ancestors = this.traverse([start], {
      relationshipTypes: ['reply-root', 'reply-parent'],
      direction: 'outbound', depth, limit,
    });
    const eventSubjects = uniqueSubjects([
      start,
      ...descendants.items.map(({ subject: item }) => item).filter(({ type }) => type === 'event'),
      ...ancestors.items.map(({ subject: item }) => item).filter(({ type }) => type === 'event'),
    ]).filter((item) => Boolean(this.getEvent(item.id)));
    const participants = this.traverse(eventSubjects, {
      relationshipTypes: ['author', 'mentioned-account'],
      direction: 'outbound', depth: 1, limit,
    });
    const allEdges = [...ancestors.context.relationships, ...descendants.context.relationships];
    const known = (edge) => edge.evidence?.interpretation === 'known';
    const directReplies = allEdges.filter((edge) => (
      known(edge) && edge.direction === 'inbound' && edge.depth === 1
    ));
    const deeperDescendants = allEdges.filter((edge) => (
      known(edge) && edge.direction === 'inbound' && edge.depth > 1
    ));
    return {
      type: 'thread',
      start,
      collection: resultCollection(
        uniqueSubjects([
          ...eventSubjects,
          ...participants.items.map(({ subject: item }) => item)
            .filter(({ type }) => type === 'account'),
        ]).map((item) => ({ subject: item, reasons: [], provenance: [] })),
        { operation: 'thread', relationships: [...allEdges, ...participants.context.relationships] },
      ),
      ancestors: allEdges.filter((edge) => known(edge) && edge.direction === 'outbound'),
      directReplies,
      descendants: deeperDescendants,
      participants: uniqueSubjects(participants.items.map(({ subject: item }) => item)
        .filter(({ type }) => type === 'account')),
      ambiguous: allEdges.filter((edge) => !known(edge)),
    };
  }

  combineSets(operation, leftSetId, rightSetId, name) {
    this.#assertOpen();
    if (!['union', 'intersection', 'difference'].includes(operation)) {
      throw new ResearchMemoryError('Set operation must be "union", "intersection", or "difference".');
    }
    const left = this.getSet(leftSetId);
    const right = this.getSet(rightSetId);
    const rightKeys = new Set(right.members.map(memberKey));
    const selected = operation === 'union'
      ? [...left.members, ...right.members]
      : operation === 'intersection'
        ? left.members.filter((member) => rightKeys.has(memberKey(member)))
        : left.members.filter((member) => !rightKeys.has(memberKey(member)));
    return this.#createPopulatedSet(name, selected.map((member) => {
      const sources = [
        ...(left.members.some((candidate) => memberKey(candidate) === memberKey(member))
          ? [{ setId: left.id, reasons: left.members.find((candidate) => memberKey(candidate) === memberKey(member)).reasons }]
          : []),
        ...(right.members.some((candidate) => memberKey(candidate) === memberKey(member))
          ? [{ setId: right.id, reasons: right.members.find((candidate) => memberKey(candidate) === memberKey(member)).reasons }]
          : []),
      ];
      return { member, reasons: [{
        type: 'set-operation', operation, leftSetId, rightSetId, sources,
      }] };
    }));
  }

  /** Reports storage-level totals without exposing a schema to callers. */
  summary() {
    this.#assertOpen();
    const events = this.#database.prepare('SELECT COUNT(*) AS count FROM events').get().count;
    const observations = this.#database.prepare('SELECT COUNT(*) AS count FROM observations').get().count;
    return {
      events: Number(events),
      observations: Number(observations),
    };
  }

  /** Imports the inspectable, reproducible fixture corpus through ingest(). */
  importFixtures(observation) {
    this.#assertOpen();
    return loadFixtureEvents().map((event) => this.ingest(event, observation));
  }

  #assertStoredRecord(item, record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new ResearchMemoryError('An embedded record must be an object.');
    }
    const embeddedEvent = item.type === 'event' ? record.event : record.metadataEvent;
    if (!embeddedEvent || embeddedEvent.id === undefined) {
      throw new ResearchMemoryError(
        `Embedded records are not supported for ${item.type} subjects without canonical event evidence.`,
      );
    }
    if (item.type === 'event' && embeddedEvent.id !== item.id) {
      throw new ResearchMemoryError('Embedded event evidence must match its event subject.');
    }
    if (item.type === 'account' && embeddedEvent.pubkey !== item.id) {
      throw new ResearchMemoryError('Embedded metadata evidence must match its account subject.');
    }
    const stored = item.type === 'event'
      ? this.getEvent(item.id)
      : currentAccountMetadata(this.#database, item.id);
    const canonical = item.type === 'event'
      ? stored
      : stored && {
        profile: parseProfile(stored.event),
        metadataEvent: stored.event,
        observations: stored.observations,
      };
    if (!canonical || stableJson(canonical) !== stableJson(record)) {
      throw new ResearchMemoryError(
        'Embedded record must exactly match the canonical record stored in research memory.',
      );
    }
  }

  close() {
    if (!this.#closed) {
      this.#database.close();
      this.#closed = true;
    }
  }

}

/**
 * The promoted indexed corpus proven by ResearchWorkspace. Both the
 * migration-era workspace and the prospective memory use this one owner for
 * canonical records and every index derived from them.
 */
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

/**
 * The prospective single-corpus implementation. SQLite remains a migration
 * oracle until the runtime cut-over.
 */
export class InMemoryResearchMemory {
  #capacity;
  #closed = false;
  #corpus = new IndexedEventCorpus();
  #nextObservationId = 1;
  #evictions = 0;
  #coverage = new Map();
  #runs = new Map();
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

  ingest(event, observation) {
    this.#assertOpen();
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
      const oldest = this.#corpus.records.keys().next().value;
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

  searchEvents(query = {}) {
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
    return {
      query: publicEventQuery(normalized),
      results: cloneJson(results.slice(0, normalized.limit)),
    };
  }

  select(query = {}) {
    const result = this.searchEvents(query);
    return resultCollection(result.results.map(({ event, observations, matchReasons }) => ({
      subject: subject('event', event.id),
      record: { event, observations },
      reasons: matchReasons,
      provenance: observations,
    })), { operation: 'selection', query: result.query });
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
      return resultCollection(value.results.map((item) => item.event ? ({
        subject: subject('event', item.event.id),
        record: { event: item.event, observations: item.observations ?? [] },
        reasons: item.matchReasons ?? [], provenance: item.observations ?? [],
      }) : ({
        subject: subject('account', item.publicKey),
        record: {
          profile: item.profile, metadataEvent: item.metadataEvent,
          observations: item.observations ?? [],
        },
        reasons: item.matchReasons ?? [], provenance: item.observations ?? [],
      })), { operation: 'adapted-results', query: value.query });
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
      return subject('event', resolveOnePrefix(item.id, [...this.#corpus.records.keys()], 'event ID'));
    }
    if (item.type === 'account') return this.#resolveAccountSubject(item.id);
    if (item.type === 'set') return subject('set', this.getSet(item.id).id);
    if (item.type === 'run') return subject('run', this.getRun(item.id).id);
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
            provenance: [{
              type: 'stored-event-observations', eventId: relation.sourceEventId,
            }],
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

  relatedEvent(id) {
    const resolved = this.resolve(id, 'event');
    return navigationFromTraversal(this, this.traverse([resolved], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: MAX_QUERY_LIMIT,
    }));
  }

  relatedAccount(id) {
    const resolved = this.resolve(id, 'account');
    return navigationFromTraversal(this, this.traverse([resolved], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: MAX_QUERY_LIMIT,
    }));
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
    const item = normalizeSubject(reference);
    if (item.type === 'event') {
      const record = this.getEvent(item.id);
      return {
        subject: item, loaded: Boolean(record), evidence: record,
        provenance: record?.observations ?? [],
        relationships: cloneJson(this.#corpus.outbound.get(memberKey(item)) ?? []),
      };
    }
    const collection = this.traverse([item], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both', depth: 1, limit: this.#capacity,
    });
    return { subject: item, loaded: collection.context.relationships.length > 0, collection };
  }

  recordAcquisitionCoverage(result) {
    this.#assertOpen();
    const normalized = normalizeAcquisitionCoverage(result);
    for (const observed of normalized.acquiredObservations) {
      for (const observation of observed.observations) {
        const stored = this.#corpus.records.get(observed.eventId)?.observations
          .find(({ id }) => id === observation.id);
        if (!stored || stored.observedAt !== observation.observedAt) {
          throw new ResearchMemoryError(
            'Acquisition coverage observations must reference matching stored observations.',
          );
        }
      }
    }
    const id = randomUUID();
    const record = {
      id, requested: {
        filter: normalized.requested.filter,
        relays: [...normalized.requested.relays].sort(),
      },
      budget: normalized.budget, startedAt: normalized.startedAt,
      finishedAt: normalized.finishedAt, completionReason: normalized.completionReason,
      exhaustive: false,
      uncertainty: 'A bounded attempt was recorded; relay completeness is not implied.',
      relays: [...normalized.relays].sort((a, b) => a.relay.localeCompare(b.relay)),
      observedEvents: normalized.acquiredObservations.flatMap(({ eventId, observations }) => (
        observations.map((item) => ({
          eventId, observationId: item.id, observedAt: item.observedAt,
        }))
      )).sort((a, b) => a.observationId - b.observationId),
    };
    this.#coverage.set(id, cloneJson(record));
    return cloneJson(record);
  }

  getAcquisitionCoverage(id) {
    this.#assertOpen();
    const value = this.#coverage.get(id);
    if (!value) throw new ResearchMemoryError(`No acquisition coverage found for ID ${id}.`);
    return cloneJson(value);
  }

  listAcquisitionCoverage() {
    this.#assertOpen();
    return [...this.#coverage.values()]
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))
      .map(cloneJson);
  }

  acquisitionCoverage(request) {
    this.#assertOpen();
    assertPlainObject(request, 'Acquisition coverage request');
    const filter = stableJson(request.filter);
    const relays = stableJson([...request.relays].sort());
    const attempts = this.listAcquisitionCoverage().filter((item) => (
      stableJson(item.requested.filter) === filter && stableJson(item.requested.relays) === relays
    ));
    return {
      attempted: attempts.length > 0, exhaustive: false,
      uncertainty: 'Coverage records bounded attempts and observations, not an exhaustive relay index.',
      request: cloneJson(request), attempts,
    };
  }

  recordRun(run) {
    this.#assertOpen();
    const record = { id: randomUUID(), ...normalizeRun(run) };
    this.#runs.set(record.id, cloneJson(record));
    return cloneJson(record);
  }

  getRun(id) {
    this.#assertOpen();
    const run = this.#runs.get(id);
    if (!run) throw new ResearchMemoryError(`No research run found for ID ${id}.`);
    return cloneJson(run);
  }

  listRuns() {
    this.#assertOpen();
    return [...this.#runs.values()]
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))
      .map(({ diagnostics, results, ...run }) => ({
        ...cloneJson(run), diagnosticCount: diagnostics.length, resultCount: results.length,
      }));
  }

  createSet(name) {
    const created = this.#createPopulatedSet(name, []);
    return this.getSet(created.id);
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

  addSetMember(id, member, reason = { type: 'explicit' }) {
    const set = this.getSet(id);
    const normalized = normalizeMember(member);
    let found = set.members.find((item) => memberKey(item) === memberKey(normalized));
    if (!found) {
      found = { ...normalized, reasons: [] };
      set.members.push(found);
      set.members.sort((a, b) => memberKey(a).localeCompare(memberKey(b)));
    }
    const normalizedReason = normalizeReason(reason);
    if (!found.reasons.some((item) => stableJson(item) === stableJson(normalizedReason))) {
      found.reasons.push(normalizedReason);
    }
    this.#sets.set(id, set);
    return { set: { id, name: set.name }, member: cloneJson(found) };
  }

  removeSetMember(id, member) {
    const set = this.getSet(id);
    const normalized = normalizeMember(member);
    const before = set.members.length;
    set.members = set.members.filter((item) => memberKey(item) !== memberKey(normalized));
    this.#sets.set(id, set);
    return { ...normalized, removed: before !== set.members.length };
  }

  explainSetMember(id, member) {
    const set = this.getSet(id);
    const normalized = normalizeMember(member);
    const found = set.members.find((item) => memberKey(item) === memberKey(normalized));
    if (!found) {
      throw new ResearchMemoryError(
        `Research set ${id} has no ${normalized.type} member ${normalized.id}.`,
      );
    }
    return { set: { id, name: set.name }, member: cloneJson(found) };
  }

  createSetFromRun(name, runId) {
    const run = this.getRun(runId);
    return this.#createPopulatedSet(name, run.results.map((result) => ({
      member: result,
      reasons: [{
        type: 'run', runId, operation: run.operation,
        matchReasons: result.reasons, provenance: result.provenance,
      }],
    })));
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

  expandSet(sourceSetId, name, options = {}) {
    const traversal = this.traverse([subject('set', sourceSetId)], {
      relationshipTypes: options.relationshipTypes,
      direction: options.direction ?? 'outbound', depth: 1, limit: options.limit,
    });
    const starts = new Set(traversal.context.starts.map(memberKey));
    return this.retain({
      ...traversal, items: traversal.items.filter((item) => !starts.has(memberKey(item.subject))),
    }, name, { reason: { type: 'set-expansion', sourceSetId } });
  }

  combineSets(operation, leftId, rightId, name) {
    if (!['union', 'intersection', 'difference'].includes(operation)) {
      throw new ResearchMemoryError('Set operation must be "union", "intersection", or "difference".');
    }
    const left = this.getSet(leftId);
    const right = this.getSet(rightId);
    const rightKeys = new Set(right.members.map(memberKey));
    const selected = operation === 'union' ? [...left.members, ...right.members]
      : operation === 'intersection'
        ? left.members.filter((item) => rightKeys.has(memberKey(item)))
        : left.members.filter((item) => !rightKeys.has(memberKey(item)));
    return this.#createPopulatedSet(name, selected.map((member) => {
      const key = memberKey(member);
      const sources = [
        ...left.members.filter((candidate) => memberKey(candidate) === key)
          .map((candidate) => ({ setId: left.id, reasons: candidate.reasons })),
        ...right.members.filter((candidate) => memberKey(candidate) === key)
          .map((candidate) => ({ setId: right.id, reasons: candidate.reasons })),
      ];
      return { member, reasons: [{
        type: 'set-operation', operation, leftSetId: leftId, rightSetId: rightId, sources,
      }] };
    }));
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
      } else if (reference.type === 'run') {
        projection = { type: 'run', ...this.getRun(reference.id) };
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

  summary() {
    this.#assertOpen();
    return {
      events: this.#corpus.records.size,
      observations: [...this.#corpus.records.values()]
        .reduce((sum, record) => sum + record.observations.length, 0),
    };
  }

  importFixtures(observation) {
    return loadFixtureEvents().map((event) => this.ingest(event, observation));
  }

  reset() {
    this.#assertOpen();
    this.#corpus.clear();
    this.#coverage.clear(); this.#runs.clear(); this.#sets.clear();
    this.#nextObservationId = 1; this.#evictions = 0;
  }

  close() {
    if (!this.#closed) {
      this.reset();
      this.#closed = true;
    }
  }
}

/**
 * A temporary indexed working corpus. SQLite is consulted only by explicit
 * loading, hydration, projection, inspection fallback, and retention.
 */
class ResearchWorkspace {
  #memory;
  #capacity;
  #closed = false;
  #corpus = new IndexedEventCorpus();
  #evictions = 0;

  constructor(memory, capacity) {
    this.#memory = memory;
    this.#capacity = capacity;
  }

  /** Replaces the corpus with one explicitly selected, bounded SQLite slice. */
  load(query = {}) {
    this.#assertOpen();
    assertPlainObject(query, 'Workspace load query');
    const selected = this.#memory.select({
      ...query,
      limit: query.limit ?? this.#capacity,
    });
    this.#clearCorpus();
    const change = this.#addCollection(selected);
    return {
      ...change,
      collection: this.select({ limit: this.#capacity, order: query.order ?? 'newest' }),
      bounds: this.describe(),
    };
  }

  /**
   * Hydrates stored event subjects or public result output into the corpus.
   * Existing IDs refresh provenance without consuming capacity or changing
   * FIFO position.
   */
  add(value, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'Workspace add options');
    rejectUnknownKeys(options, new Set(['preserve']), 'workspace add option');
    if (options.preserve !== undefined && !Array.isArray(options.preserve)) {
      throw new ResearchMemoryError('Workspace add preserve must be an array of event subjects.');
    }
    const preserve = new Set((options.preserve ?? []).map((item) => {
      const normalized = normalizeSubject(item);
      if (normalized.type !== 'event') {
        throw new ResearchMemoryError('Workspace preserved subjects must be events.');
      }
      return normalized.id;
    }));
    if (preserve.size > this.#capacity) {
      throw new ResearchMemoryError('Workspace capacity cannot accommodate all preserved events.');
    }
    const collection = this.#coerceEvidence(value);
    const change = this.#addCollection(collection, preserve);
    return { ...change, bounds: this.describe() };
  }

  /** Selects only loaded events using the durable memory's query semantics. */
  select(query = {}) {
    this.#assertOpen();
    const normalized = normalizeEventQuery(query);
    const events = [...this.#corpus.records.values()].map(({ event }) => event);
    const ids = resolvePrefixes(normalized.ids, events.map(({ id }) => id), 'event ID');
    const authors = resolvePrefixes(
      normalized.authors, events.map(({ pubkey }) => pubkey), 'author public key',
    );
    const candidates = this.#corpus.candidateIds(normalized, ids, authors);
    const matches = [];
    for (const eventId of candidates) {
      const record = this.#corpus.records.get(eventId);
      const reasons = matchEvent(record.event, normalized, ids, authors);
      if (reasons) matches.push({ record, reasons });
    }
    matches.sort((left, right) => (
      compareEvents(left.record.event, right.record.event, normalized.order)
    ));
    return resultCollection(matches.slice(0, normalized.limit).map(({ record, reasons }) => ({
      subject: subject('event', record.event.id),
      record: cloneJson(record),
      reasons,
      provenance: record.observations,
    })), {
      operation: 'workspace-selection',
      query: publicEventQuery(normalized),
    });
  }

  /**
   * Traverses relationships derived from loaded source events. Targets may be
   * unresolved subjects, but only loaded events can contribute or expand
   * relationship edges.
   */
  traverse(starting, options = {}) {
    this.#assertOpen();
    const normalized = normalizeTraversal(options);
    const starts = this.#startingSubjects(starting);
    const queue = starts.map((item) => ({ subject: item, depth: 0 }));
    const visited = new Map(starts.map((item) => [memberKey(item), {
      subject: item, role: 'seed', reasons: [{ type: 'traversal-start' }], provenance: [],
    }]));
    const relationships = [];
    const edgeKeys = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.depth >= normalized.depth) continue;
      const relations = [
        ...(normalized.direction !== 'inbound'
          ? this.#corpus.outbound.get(memberKey(current.subject)) ?? [] : []),
        ...(normalized.direction !== 'outbound'
          ? this.#corpus.inbound.get(memberKey(current.subject)) ?? [] : []),
      ];
      for (const relation of relations) {
        if (!normalized.relationshipTypes.includes(relation.type)) continue;
        const next = relation.direction === 'outbound'
          ? subject(relation.target.type, relation.target.id)
          : subject('event', relation.sourceEventId);
        const stepDepth = current.depth + 1;
        const edge = {
          source: current.subject,
          target: next,
          direction: relation.direction,
          type: relation.type,
          depth: stepDepth,
          sourceEventId: relation.sourceEventId,
          evidence: relation.evidence,
        };
        const edgeKey = stableJson(edge);
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          relationships.push(edge);
        }
        const key = memberKey(next);
        const reason = {
          type: 'relationship',
          relationshipType: relation.type,
          direction: relation.direction,
          depth: stepDepth,
          source: current.subject,
          sourceEventId: relation.sourceEventId,
          evidence: relation.evidence,
        };
        if (!visited.has(key) && visited.size - starts.length < normalized.limit) {
          visited.set(key, {
            subject: next,
            role: 'discovery',
            reasons: [reason],
            provenance: this.#relationshipProvenance(relation.sourceEventId),
          });
          queue.push({ subject: next, depth: stepDepth });
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
      operation: 'workspace-traversal',
      starts,
      relationshipTypes: normalized.relationshipTypes,
      direction: normalized.direction,
      depth: normalized.depth,
      limit: normalized.limit,
      relationships,
    });
  }

  /** Inspects loaded evidence, with an explicit SQLite fallback for an event. */
  inspect(reference, options = {}) {
    this.#assertOpen();
    assertPlainObject(options, 'Workspace inspection options');
    rejectUnknownKeys(options, new Set(['loadIfMissing']), 'workspace inspection option');
    const item = normalizeSubject(reference);
    if (item.type === 'event') {
      let record = this.#corpus.records.get(item.id);
      let loaded = Boolean(record);
      if (!record && options.loadIfMissing) {
        record = this.#memory.getEvent(item.id);
        if (record) {
          this.#addCollection(resultCollection([{
            subject: item, record,
          }], { operation: 'workspace-inspection-load' }));
          record = this.#corpus.records.get(item.id);
          loaded = Boolean(record);
        }
      }
      if (!record) return { subject: item, loaded: false, evidence: null, relationships: [] };
      return {
        subject: item,
        loaded,
        evidence: cloneJson(record),
        provenance: cloneJson(record.observations),
        relationships: cloneJson(this.#corpus.outbound.get(memberKey(item)) ?? []),
      };
    }
    const related = this.traverse([item], {
      relationshipTypes: [...NAVIGATION_RELATIONSHIP_TYPES],
      direction: 'both',
      depth: 1,
      limit: this.#capacity,
    });
    return {
      subject: item,
      loaded: related.context.relationships.length > 0,
      collection: related,
    };
  }

  /** Persists a workspace result through the attached SQLite memory. */
  retain(collection, name, options = {}) {
    this.#assertOpen();
    return this.#memory.retain(collection, name, options);
  }

  /** Keeps result collections compatible with sessions and other consumers. */
  asCollection(value) {
    this.#assertOpen();
    if (value?.type === 'result-collection') {
      assertResultCollection(value);
      return value;
    }
    return this.#memory.asCollection(value);
  }

  /** Constructs a reusable collection using the attached memory's integrity checks. */
  collection(items, context = {}) {
    this.#assertOpen();
    return this.#memory.collection(items, context);
  }

  /** Uses durable projection without making workspace selection/traversal durable queries. */
  project(value, options = {}) {
    this.#assertOpen();
    return this.#memory.project(value, options);
  }

  /** Returns corpus bounds and index counts without exposing internal maps. */
  describe() {
    this.#assertOpen();
    return this.#corpus.describe(this.#capacity, this.#evictions);
  }

  close() {
    if (!this.#closed) {
      this.#clearCorpus();
      this.#closed = true;
    }
  }

  #assertOpen() {
    if (this.#closed) {
      throw new ResearchMemoryError('This research workspace has already been closed.');
    }
  }

  #clearCorpus() {
    this.#corpus.clear();
  }

  #coerceEvidence(value) {
    if (value?.type === 'result-collection' || value?.collection
      || value?.results || value?.acquiredObservations) {
      return this.#memory.asCollection(value);
    }
    const values = Array.isArray(value) ? value : [value];
    return resultCollection(values.map((item) => ({
      subject: normalizeSubject(item),
    })), { operation: 'workspace-add' });
  }

  #addCollection(collection, preserve = new Set()) {
    assertResultCollection(collection);
    const added = [];
    const refreshed = [];
    const evicted = [];
    for (const item of collection.items) {
      if (item.subject.type !== 'event') continue;
      const stored = this.#memory.getEvent(item.subject.id);
      if (!stored) {
        throw new ResearchMemoryError(`No stored event found for ID ${item.subject.id}.`);
      }
      if (this.#corpus.records.has(stored.event.id)) {
        this.#corpus.records.set(stored.event.id, cloneJson(stored));
        refreshed.push(stored.event.id);
        continue;
      }
      this.#corpus.insert(stored);
      added.push(stored.event.id);
      if (this.#corpus.records.size > this.#capacity) {
        // FIFO remains the policy, except callers may protect a small explicit
        // set for the duration of one add. The oldest disposable record goes.
        const eventId = [...this.#corpus.records.keys()].find((id) => !preserve.has(id));
        if (eventId === undefined) {
          throw new ResearchMemoryError('Workspace capacity cannot accommodate preserved events.');
        }
        this.#corpus.remove(eventId);
        this.#evictions += 1;
        evicted.push(eventId);
      }
    }
    return { added, refreshed, evicted };
  }

  #startingSubjects(starting) {
    const values = starting?.type === 'result-collection'
      ? starting.items.map(({ subject: item }) => item)
      : Array.isArray(starting) ? starting : [starting];
    return uniqueSubjects(values.map((item) => {
      const normalized = normalizeSubject(item);
      if (normalized.type === 'event') {
        return subject('event', resolveOnePrefix(
          normalized.id, [...this.#corpus.records.keys()], 'workspace event ID',
        ));
      }
      return normalized;
    }));
  }

  #relationshipProvenance(eventId) {
    const observations = this.#corpus.records.get(eventId)?.observations ?? [];
    return observations.length
      ? cloneJson(observations)
      : [{ type: 'loaded-event', eventId }];
  }
}

/** Returns a fresh copy of the committed fixture events. */
export function loadFixtureEvents() {
  const fixturePath = new URL('../fixtures/events.json', import.meta.url);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

export function isCanonicalNostrEvent(event) {
  if (!validateEvent(event)) return false;
  if (!EVENT_ID.test(event.id) || !SIGNATURE.test(event.sig)) return false;
  if (!Number.isSafeInteger(event.kind) || event.kind < 0) return false;
  if (!Number.isSafeInteger(event.created_at) || event.created_at < 0) return false;
  // nostr-tools memoizes verification on the object it receives. Verify a
  // shallow copy so validating evidence never annotates the caller's object.
  return verifyEvent({ ...event });
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

function observationsForEventIds(database, eventIds) {
  const byEvent = new Map(eventIds.map((eventId) => [eventId, []]));
  if (eventIds.length === 0) return byEvent;
  const placeholders = eventIds.map(() => '?').join(',');
  for (const row of database.prepare(`
    SELECT observation_id, event_id, relay, observed_at
    FROM observations
    WHERE event_id IN (${placeholders})
    ORDER BY event_id, observation_id
  `).all(...eventIds)) {
    byEvent.get(row.event_id).push({
      id: Number(row.observation_id), relay: row.relay, observedAt: row.observed_at,
    });
  }
  return byEvent;
}

function hydrateEventRows(database, rows) {
  const observations = observationsForEventIds(database, rows.map(({ event_id }) => event_id));
  return rows.map((row) => ({
    event: JSON.parse(row.raw_event),
    observations: observations.get(row.event_id) ?? [],
  }));
}

function resolveStoredPrefixes(database, prefixes, expression, label) {
  if (!prefixes) return null;
  const resolved = new Set();
  for (const prefix of prefixes) {
    const rows = database.prepare(`
      SELECT DISTINCT ${expression} AS value FROM events
      WHERE ${expression} >= ? AND ${expression} < ?
      ORDER BY value LIMIT 2
    `).all(prefix, `${prefix}g`);
    if (rows.length > 1) {
      throw new ResearchMemoryError(`Ambiguous ${label} prefix ${prefix}: multiple stored values match.`);
    }
    if (rows.length === 1) resolved.add(rows[0].value);
  }
  return resolved;
}

function resolveStoredPrefix(database, prefix, expression, label) {
  const normalized = normalizeStringList(prefix, label, true)[0];
  const resolved = resolveStoredPrefixes(database, [normalized], expression, label);
  if (resolved.size === 0) {
    throw new ResearchMemoryError(`No stored ${label} matches ${normalized}.`);
  }
  return [...resolved][0];
}

function selectedEventRecords(database, query, ids, authors) {
  const clauses = [];
  const parameters = [];
  const addList = (expression, values) => {
    if (!values) return;
    clauses.push(`${expression} IN (${[...values].map(() => '?').join(',')})`);
    parameters.push(...values);
  };
  addList('event_id', ids);
  addList("json_extract(raw_event, '$.pubkey')", authors);
  addList("CAST(json_extract(raw_event, '$.kind') AS INTEGER)", query.kinds);
  if (query.since !== undefined) {
    clauses.push("CAST(json_extract(raw_event, '$.created_at') AS INTEGER) >= ?");
    parameters.push(query.since);
  }
  if (query.until !== undefined) {
    clauses.push("CAST(json_extract(raw_event, '$.created_at') AS INTEGER) <= ?");
    parameters.push(query.until);
  }
  for (const [name, values] of Object.entries(query.tags)) {
    clauses.push(`EXISTS (
      SELECT 1 FROM json_each(json_extract(raw_event, '$.tags')) AS tag
      WHERE json_extract(tag.value, '$[0]') = ?
        AND json_extract(tag.value, '$[1]') IN (${values.map(() => '?').join(',')})
    )`);
    parameters.push(name, ...values);
  }
  for (const term of query.terms) {
    clauses.push("instr(lower(json_extract(raw_event, '$.content')), lower(?)) > 0");
    parameters.push(term);
  }
  const direction = query.order === 'newest' ? 'DESC' : 'ASC';
  const rows = database.prepare(`
    SELECT event_id, raw_event FROM events
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY CAST(json_extract(raw_event, '$.created_at') AS INTEGER) ${direction}, event_id
    LIMIT ?
  `).all(...parameters, query.limit);
  return hydrateEventRows(database, rows);
}

function currentAccountMetadata(database, publicKey) {
  return currentReplaceableEvent(database, publicKey, 0);
}

function currentReplaceableEvent(database, publicKey, kind, identifier) {
  const parameters = [publicKey, kind];
  const parameterized = kind >= 30000 && kind < 40000;
  const row = database.prepare(`
    SELECT event_id, raw_event FROM events
    WHERE json_extract(raw_event, '$.pubkey') = ?
      AND CAST(json_extract(raw_event, '$.kind') AS INTEGER) = ?
      ${parameterized ? `AND COALESCE((
        SELECT json_extract(tag.value, '$[1]')
        FROM json_each(json_extract(raw_event, '$.tags')) AS tag
        WHERE json_extract(tag.value, '$[0]') = 'd'
        ORDER BY CAST(tag.key AS INTEGER)
        LIMIT 1
      ), '') = ?` : ''}
    ORDER BY CAST(json_extract(raw_event, '$.created_at') AS INTEGER) DESC, event_id
    LIMIT 1
  `).get(...parameters, ...(parameterized ? [identifier] : []));
  return row ? hydrateEventRows(database, [row])[0] : null;
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
    } else if (item.type === 'run') {
      expanded.push(...memory.getRun(item.id).results.map(({ type, id }) => subject(type, id)));
    } else {
      expanded.push(item);
    }
  }
  return uniqueSubjects(expanded);
}

function navigationFromTraversal(memory, collection) {
  const start = collection.context.starts[0];
  return {
    subject: { ...start },
    collection,
    relationships: collection.context.relationships.map((edge) => {
      const sourceEvent = memory.getEvent(edge.sourceEventId);
      let resolved = true;
      if (edge.target.type === 'event') resolved = Boolean(memory.getEvent(edge.target.id));
      if (edge.target.type === 'account') {
        try {
          memory.resolve(edge.target.id, 'account');
        } catch {
          resolved = false;
        }
      }
      return {
        direction: edge.direction,
        type: edge.type,
        sourceEventId: edge.sourceEventId,
        target: { ...edge.target, resolved },
        evidence: edge.evidence,
        ...(sourceEvent ? { sourceEvent } : {}),
        ...(edge.target.type === 'event' && resolved
          ? { targetEvent: memory.getEvent(edge.target.id) } : {}),
      };
    }),
  };
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

function accountSummaryForKey(database, publicKey, excerptLimit) {
  const metadata = currentAccountMetadata(database, publicKey);
  const profile = metadata ? parseProfile(metadata.event) : {};
  const relays = database.prepare(`
    SELECT DISTINCT o.relay
    FROM events AS e
    JOIN observations AS o ON o.event_id = e.event_id
    WHERE json_extract(e.raw_event, '$.pubkey') = ?
    ORDER BY o.relay
  `).all(publicKey).map(({ relay }) => relay);
  return {
    publicKey,
    name: profile.name,
    displayName: profile.display_name,
    nip05: profile.nip05,
    descriptionExcerpt: typeof profile.about === 'string'
      ? excerpt(profile.about, excerptLimit) : undefined,
    metadataEventId: metadata?.event.id,
    relays,
  };
}

function relationshipsForSubject(database, subjectType, subjectId) {
  const rows = database.prepare(`
    SELECT source_event_id, relationship_type, target_type, target_id, evidence,
      CASE WHEN source_event_id = ? AND ? = 'event' THEN 'outbound' ELSE 'inbound' END AS direction
    FROM event_relationships
    WHERE (source_event_id = ? AND ? = 'event')
       OR (target_type = ? AND target_id = ?)
    ORDER BY direction, source_event_id, relationship_type, target_id
  `).all(subjectId, subjectType, subjectId, subjectType, subjectType, subjectId);
  return rows.map((row) => ({
    direction: row.direction,
    type: row.relationship_type,
    sourceEventId: row.source_event_id,
    target: {
      type: row.target_type,
      id: row.target_id,
      resolved: row.target_type === 'event'
        ? Boolean(database.prepare('SELECT 1 FROM events WHERE event_id = ?').get(row.target_id))
        : row.target_type === 'account'
          ? Boolean(database.prepare(`
              SELECT 1 FROM events
              WHERE json_extract(raw_event, '$.pubkey') = ?
              LIMIT 1
            `).get(row.target_id))
          : true,
    },
    evidence: JSON.parse(row.evidence),
  }));
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

function normalizeRun(run) {
  assertPlainObject(run, 'Research run');
  rejectUnknownKeys(
    run,
    new Set(['operation', 'inputs', 'startedAt', 'finishedAt', 'status', 'diagnostics', 'results']),
    'research run',
  );
  if (!['acquisition', 'event-query', 'account-query'].includes(run.operation)) {
    throw new ResearchMemoryError(
      'Research run operation must be "acquisition", "event-query", or "account-query".',
    );
  }
  assertPlainObject(run.inputs, 'Research run inputs');
  const startedAt = normalizeIsoDate(run.startedAt, 'Research run startedAt');
  const finishedAt = normalizeIsoDate(run.finishedAt, 'Research run finishedAt');
  if (Date.parse(finishedAt) < Date.parse(startedAt)) {
    throw new ResearchMemoryError('Research run finishedAt must not precede startedAt.');
  }
  if (typeof run.status !== 'string' || run.status.trim().length === 0) {
    throw new ResearchMemoryError('Research run status must be a non-empty string.');
  }
  const diagnostics = run.diagnostics ?? [];
  if (!Array.isArray(diagnostics)) {
    throw new ResearchMemoryError('Research run diagnostics must be an array.');
  }
  if (!Array.isArray(run.results)) {
    throw new ResearchMemoryError('Research run results must be an array.');
  }
  const results = run.results.map((result) => {
    assertPlainObject(result, 'Research run result');
    rejectUnknownKeys(result, new Set(['type', 'id', 'reasons', 'provenance']), 'research run result');
    const member = normalizeMember(result);
    if (result.reasons !== undefined && !Array.isArray(result.reasons)) {
      throw new ResearchMemoryError('Research run result reasons must be an array.');
    }
    if (result.provenance !== undefined && !Array.isArray(result.provenance)) {
      throw new ResearchMemoryError('Research run result provenance must be an array.');
    }
    return {
      ...member,
      reasons: cloneJson(result.reasons ?? []),
      provenance: cloneJson(result.provenance ?? []),
    };
  });
  return {
    operation: run.operation,
    inputs: normalizeRunInputs(run.operation, run.inputs),
    startedAt,
    finishedAt,
    status: run.status.trim(),
    diagnostics: cloneJson(diagnostics),
    results,
  };
}

function normalizeRunInputs(operation, inputs) {
  if (operation === 'event-query') {
    return publicEventQuery(normalizeEventQuery({
      ...inputs,
      ...(Array.isArray(inputs.text) && inputs.text.length === 0 ? { text: undefined } : {}),
    }));
  }
  if (operation === 'account-query') {
    const normalized = normalizeAccountQuery({
      ...inputs,
      ...(Array.isArray(inputs.text) && inputs.text.length === 0 ? { text: undefined } : {}),
    });
    return {
      publicKeys: normalized.publicKeys,
      text: normalized.terms,
      limit: normalized.limit,
    };
  }
  return normalizeAcquisitionRunInputs(inputs);
}

function normalizeAcquisitionRunInputs(inputs) {
  rejectUnknownKeys(
    inputs,
    new Set(['relays', 'filter', 'timeoutMs', 'eventLimit', 'concurrency']),
    'acquisition input',
  );
  if (!Array.isArray(inputs.relays) || inputs.relays.length === 0) {
    throw new ResearchMemoryError('Acquisition inputs require at least one explicit wss:// relay.');
  }
  const relays = inputs.relays.map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new ResearchMemoryError(`Invalid relay URL: ${value}`);
    }
    if (url.protocol !== 'wss:' || url.username || url.password || url.hash) {
      throw new ResearchMemoryError(`Relay URL must be an explicit wss:// URL: ${value}`);
    }
    return url.href;
  });
  if (new Set(relays).size !== relays.length) {
    throw new ResearchMemoryError('Acquisition input relay URLs must not be repeated.');
  }
  const filter = normalizeAcquisitionFilter(inputs.filter);
  return {
    relays,
    filter,
    timeoutMs: normalizePositiveInteger(
      inputs.timeoutMs ?? DEFAULT_ACQUISITION_TIMEOUT_MS,
      'Acquisition input timeoutMs',
    ),
    eventLimit: normalizePositiveInteger(
      inputs.eventLimit ?? DEFAULT_ACQUISITION_EVENT_LIMIT,
      'Acquisition input eventLimit',
    ),
    concurrency: normalizePositiveInteger(
      inputs.concurrency ?? DEFAULT_RELAY_CONCURRENCY,
      'Acquisition input concurrency',
    ),
  };
}

function normalizeAcquisitionFilter(filter) {
  assertPlainObject(filter, 'Acquisition input filter');
  const normalized = cloneJson(filter);
  for (const [key, value] of Object.entries(normalized)) {
    if (['ids', 'authors'].includes(key)) {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new ResearchMemoryError(`Acquisition filter ${key} must be an array of strings.`);
      }
    } else if (key === 'kinds') {
      if (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item) || item < 0)) {
        throw new ResearchMemoryError('Acquisition filter kinds must be an array of non-negative integers.');
      }
    } else if (['since', 'until', 'limit'].includes(key)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new ResearchMemoryError(`Acquisition filter ${key} must be a non-negative integer.`);
      }
    } else if (key.startsWith('#')) {
      if (key.length !== 2 || !Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new ResearchMemoryError(
          `Acquisition filter ${key} must be a single-letter tag with an array of strings.`,
        );
      }
    } else {
      throw new ResearchMemoryError(`Unsupported acquisition filter field: ${key}`);
    }
  }
  return normalized;
}

function normalizePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ResearchMemoryError(`${label} must be a positive integer.`);
  }
  return value;
}

function normalizeIsoDate(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new ResearchMemoryError(`${label} must be a valid ISO-8601 timestamp.`);
  }
  return new Date(value).toISOString();
}

function publicRun(row) {
  return {
    id: row.run_id,
    operation: row.operation,
    inputs: JSON.parse(row.inputs),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    diagnostics: JSON.parse(row.diagnostics),
    results: JSON.parse(row.results),
  };
}

function publicRunSummary(row) {
  return {
    id: row.run_id,
    operation: row.operation,
    inputs: JSON.parse(row.inputs),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    diagnosticCount: Number(row.diagnostic_count),
    resultCount: Number(row.result_count),
  };
}

function publicSetSummary(row) {
  return {
    id: row.set_id,
    name: row.name,
    createdAt: row.created_at,
    memberCount: Number(row.member_count),
    reasonCount: Number(row.reason_count),
    counts: {
      event: Number(row.event_count),
      account: Number(row.account_count),
      tag: Number(row.tag_count),
      set: Number(row.set_count),
      run: Number(row.run_count),
    },
  };
}

function compactSetRecord(database, setId, previewLimit) {
  const row = database.prepare(`
    SELECT s.set_id, s.name, s.created_at,
      COUNT(DISTINCT m.entity_type || ':' || m.entity_id) AS member_count,
      COUNT(DISTINCT r.reason_id) AS reason_count,
      COUNT(DISTINCT CASE WHEN m.entity_type = 'event' THEN m.entity_id END) AS event_count,
      COUNT(DISTINCT CASE WHEN m.entity_type = 'account' THEN m.entity_id END) AS account_count,
      COUNT(DISTINCT CASE WHEN m.entity_type = 'tag' THEN m.entity_id END) AS tag_count,
      COUNT(DISTINCT CASE WHEN m.entity_type = 'set' THEN m.entity_id END) AS set_count,
      COUNT(DISTINCT CASE WHEN m.entity_type = 'run' THEN m.entity_id END) AS run_count
    FROM research_sets AS s
    LEFT JOIN research_set_members AS m ON m.set_id = s.set_id
    LEFT JOIN research_set_reasons AS r ON r.set_id = s.set_id
      AND r.entity_type = m.entity_type AND r.entity_id = m.entity_id
    WHERE s.set_id = ?
    GROUP BY s.set_id
  `).get(setId);
  if (!row) throw new ResearchMemoryError(`No research set found for ID ${setId}.`);
  return {
    ...publicSetSummary(row),
    preview: database.prepare(`
      SELECT entity_type AS type, entity_id AS id
      FROM research_set_members
      WHERE set_id = ?
      ORDER BY entity_type, entity_id
      LIMIT ?
    `).all(setId, previewLimit),
  };
}

function compactRunRecord(database, runId, previewLimit) {
  const row = database.prepare(`
    SELECT run_id, operation, inputs, started_at, finished_at, status,
      json_array_length(diagnostics) AS diagnostic_count,
      json_array_length(results) AS result_count
    FROM research_runs WHERE run_id = ?
  `).get(runId);
  if (!row) throw new ResearchMemoryError(`No research run found for ID ${runId}.`);
  const summary = publicRunSummary(row);
  const outcomeCounts = summary.operation === 'acquisition'
    ? Object.fromEntries(database.prepare(`
        SELECT json_extract(value, '$.outcome') AS outcome, COUNT(*) AS count
        FROM json_each((SELECT diagnostics FROM research_runs WHERE run_id = ?))
        GROUP BY outcome
      `).all(runId).map(({ outcome, count }) => [outcome, Number(count)]))
    : undefined;
  const preview = database.prepare(`
    SELECT value
    FROM json_each((SELECT results FROM research_runs WHERE run_id = ?))
    LIMIT ?
  `).all(runId, previewLimit).map(({ value }) => JSON.parse(value));
  return { ...summary, outcomeCounts, preview };
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

function normalizeAcquisitionCoverage(result) {
  assertPlainObject(result, 'Acquisition result');
  const requested = cloneJson(result.requested);
  if (!requested || !Array.isArray(requested.relays) || requested.relays.length === 0) {
    throw new ResearchMemoryError('Acquisition coverage requires requested relays.');
  }
  assertPlainObject(requested.filter, 'Acquisition NIP-01 filter');
  const budget = cloneJson(result.budget);
  for (const key of ['timeoutMs', 'eventLimit', 'concurrency']) {
    if (!Number.isSafeInteger(budget?.[key]) || budget[key] <= 0) {
      throw new ResearchMemoryError(`Acquisition coverage requires a positive ${key} budget.`);
    }
  }
  const startedAt = new Date(result.startedAt).toISOString();
  const finishedAt = new Date(result.finishedAt).toISOString();
  if (finishedAt < startedAt) {
    throw new ResearchMemoryError('Acquisition coverage cannot finish before it starts.');
  }
  if (typeof result.completionReason !== 'string' || result.completionReason.length === 0
      || !Array.isArray(result.relays) || !Array.isArray(result.acquiredObservations)) {
    throw new ResearchMemoryError('Acquisition coverage is missing outcomes or observations.');
  }
  return {
    requested, budget, startedAt, finishedAt,
    completionReason: result.completionReason,
    relays: cloneJson(result.relays),
    acquiredObservations: cloneJson(result.acquiredObservations),
  };
}

function publicAcquisitionCoverage(database, row) {
  const relayRows = database.prepare(`
    SELECT relay, contacted, outcome, received, invalid, duplicate, newly_stored,
      observations, diagnostic
    FROM acquisition_relay_outcomes WHERE attempt_id = ? ORDER BY relay
  `).all(row.attempt_id);
  const observed = database.prepare(`
    SELECT event_id, observation_id, observed_at
    FROM acquisition_observations
    WHERE attempt_id = ? ORDER BY observation_id
  `).all(row.attempt_id);
  return {
    id: row.attempt_id,
    requested: {
      filter: JSON.parse(row.filter_json),
      relays: JSON.parse(row.relays_json),
    },
    budget: {
      timeoutMs: Number(row.timeout_ms),
      eventLimit: Number(row.event_limit),
      concurrency: Number(row.concurrency),
    },
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    completionReason: row.completion_reason,
    exhaustive: false,
    uncertainty: 'A bounded attempt was recorded; relay completeness is not implied.',
    relays: relayRows.map((relay) => ({
      relay: relay.relay,
      contacted: Boolean(relay.contacted),
      outcome: relay.outcome,
      received: Number(relay.received),
      invalid: Number(relay.invalid),
      duplicate: Number(relay.duplicate),
      newlyStored: Number(relay.newly_stored),
      observations: Number(relay.observations),
      diagnostic: relay.diagnostic,
    })),
    observedEvents: observed.map((item) => ({
      eventId: item.event_id,
      observationId: Number(item.observation_id),
      observedAt: item.observed_at,
    })),
  };
}

function assertSetExists(database, setId) {
  if (typeof setId !== 'string' || !database.prepare(
    'SELECT 1 FROM research_sets WHERE set_id = ?',
  ).get(setId)) {
    throw new ResearchMemoryError(`No research set found for ID ${setId}.`);
  }
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
  DEFAULT_ACQUISITION_EVENT_LIMIT,
  DEFAULT_ACQUISITION_TIMEOUT_MS,
  DEFAULT_RELAY_CONCURRENCY,
} from './acquire.js';
export { expandResearch } from './expansion.js';
export { resolveReplyContexts } from './reply-contexts.js';
export { createResearchSession, ResearchSession } from './session.js';
