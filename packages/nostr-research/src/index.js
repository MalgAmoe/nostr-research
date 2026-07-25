import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { validateEvent, verifyEvent } from 'nostr-tools';

const SCHEMA_VERSION = 1;
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
    `);

    this.#database
      .prepare('INSERT OR REPLACE INTO schema_metadata(key, value) VALUES (?, ?)')
      .run('schema_version', String(SCHEMA_VERSION));
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
      DROP TABLE IF EXISTS observations;
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
    const events = allEventRecords(this.#database);
    const ids = resolvePrefixes(
      normalized.ids,
      events.map(({ event }) => event.id),
      'event ID',
    );
    const authors = resolvePrefixes(
      normalized.authors,
      [...new Set(events.map(({ event }) => event.pubkey))],
      'author public key',
    );

    const matches = [];
    for (const record of events) {
      const reasons = matchEvent(record.event, normalized, ids, authors);
      if (reasons) matches.push({ ...record, matchReasons: reasons });
    }
    matches.sort((left, right) => compareEvents(left.event, right.event, normalized.order));
    return {
      query: publicEventQuery(normalized),
      results: matches.slice(0, normalized.limit),
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
      const records = allEventRecords(this.#database);
      return subject('event', resolveOnePrefix(
        reference.id, records.map(({ event }) => event.id), 'event ID',
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
    const records = allEventRecords(this.#database);
    const keys = [...new Set(records.flatMap(({ event }) => [
      event.pubkey,
      ...event.tags.filter((tag) => ['p', 'P'].includes(tag[0])).map((tag) => tag[1]),
    ]).filter((value) => EVENT_ID.test(value)))];
    if (HEX_PREFIX.test(identifier)) {
      return subject('account', resolveOnePrefix(identifier, keys, 'account public key'));
    }
    const normalized = identifier.toLocaleLowerCase();
    const matches = [];
    for (const key of keys) {
      const metadata = currentMetadata(records.filter(
        ({ event }) => event.kind === 0 && event.pubkey === key,
      ));
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
    const records = allEventRecords(this.#database);
    const publicKey = resolveOnePrefix(
      publicKeyOrPrefix,
      [...new Set(records.map(({ event }) => event.pubkey))],
      'account public key',
    );
    const metadata = currentMetadata(records.filter(
      ({ event }) => event.pubkey === publicKey && event.kind === 0,
    ));
    if (!metadata) {
      throw new ResearchMemoryError(`No stored kind-0 metadata event found for account ${publicKey}.`);
    }
    return accountResult(publicKey, metadata, [{ type: 'public-key', value: publicKey }]);
  }

  /** Searches current stored account metadata, never relays or identity services. */
  searchAccounts(query = {}) {
    this.#assertOpen();
    const normalized = normalizeAccountQuery(query);
    const records = allEventRecords(this.#database);
    const byAuthor = new Map();
    for (const record of records) {
      if (record.event.kind !== 0) continue;
      const existing = byAuthor.get(record.event.pubkey);
      if (!existing || compareReplaceable(record, existing) < 0) {
        byAuthor.set(record.event.pubkey, record);
      }
    }

    const results = [];
    for (const [publicKey, metadata] of byAuthor) {
      if (normalized.publicKeys && !normalized.publicKeys.some((prefix) => publicKey.startsWith(prefix))) continue;
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
    const records = allEventRecords(this.#database);
    const queue = starts.map((item) => ({ subject: item, depth: 0 }));
    const visited = new Map(starts.map((item) => [memberKey(item), {
      subject: item, reasons: [{ type: 'traversal-start' }], provenance: [],
    }]));
    const relationships = [];
    const edgeKeys = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.depth >= depth) continue;
      const navigation = buildNavigation(
        current.subject.type, current.subject.id,
        current.subject.type === 'event'
          ? records.find(({ event }) => event.id === current.subject.id)
          : null,
        records,
      );
      for (const relation of navigation.relationships) {
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
            subject: next,
            reasons: [{
              type: 'relationship', relationshipType: relation.type,
              direction: relation.direction, depth: stepDepth,
              source: current.subject, sourceEventId: relation.sourceEventId,
              evidence: relation.evidence,
            }],
            provenance: relation.sourceEvent?.observations ?? [],
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
    return this.#database.prepare(
      'SELECT * FROM research_runs ORDER BY started_at, run_id',
    ).all().map(publicRun);
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
    return this.#database.prepare(
      'SELECT set_id FROM research_sets ORDER BY name, set_id',
    ).all().map(({ set_id }) => this.getSet(set_id));
  }

  getSet(setId) {
    this.#assertOpen();
    const row = this.#database.prepare('SELECT * FROM research_sets WHERE set_id = ?').get(setId);
    if (!row) throw new ResearchMemoryError(`No research set found for ID ${setId}.`);
    const members = this.#database.prepare(`
      SELECT entity_type, entity_id FROM research_set_members
      WHERE set_id = ? ORDER BY entity_type, entity_id
    `).all(setId).map(({ entity_type, entity_id }) => ({
      type: entity_type,
      id: entity_id,
      reasons: this.#database.prepare(`
        SELECT reason FROM research_set_reasons
        WHERE set_id = ? AND entity_type = ? AND entity_id = ? ORDER BY reason_id
      `).all(setId, entity_type, entity_id).map(({ reason }) => JSON.parse(reason)),
    }));
    return { id: row.set_id, name: row.name, createdAt: row.created_at, members };
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
    const set = this.createSet(name);
    for (const result of run.results) {
      this.addSetMember(set.id, result, {
        type: 'run',
        runId,
        operation: run.operation,
        matchReasons: result.reasons,
        provenance: result.provenance,
      });
    }
    return this.getSet(set.id);
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
    rejectUnknownKeys(options, new Set(['reason']), 'retention option');
    const created = this.createSet(name);
    for (const item of collection.items) {
      if (!RETAINABLE_SUBJECT_TYPES.has(item.subject.type)) continue;
      const reasons = item.reasons.length ? item.reasons : [{ type: 'retained-result' }];
      for (const reason of reasons) {
        this.addSetMember(created.id, item.subject, {
          ...reason,
          ...(options.reason ? { retentionContext: normalizeReason(options.reason) } : {}),
          operation: collection.context.operation,
          provenance: item.provenance,
        });
      }
    }
    return this.getSet(created.id);
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
    const relationships = (collection.context.relationships ?? []).map((edge) => ({
      ...edge,
      sourceSummary: this.#projectSubject(edge.source, 'compact', excerptLimit, previewLimit),
      targetSummary: this.#projectSubject(edge.target, 'compact', excerptLimit, previewLimit),
      interpretation: edge.evidence?.interpretation,
    }));
    const output = {
      type: 'result-collection',
      context: cloneJson(collection.context),
      results: projected.map((projection, index) => ({
        ...projection,
        reasons: cloneJson(collection.items[index].reasons),
        provenance: cloneJson(collection.items[index].provenance),
      })),
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
        const records = allEventRecords(this.#database);
        const metadata = currentMetadata(records.filter(
          ({ event }) => event.kind === 0 && event.pubkey === item.id,
        ));
        return { type: 'account', id: item.id, ...summary, ...(metadata ? {
          metadataEvent: metadata.event, observations: metadata.observations,
        } : {}) };
      }
      return { type: 'account', id: item.id, ...summary };
    }
    if (item.type === 'set') {
      const set = this.getSet(item.id);
      if (mode === 'full') return { type: 'set', ...set };
      const counts = Object.fromEntries(
        [...SUBJECT_TYPES].map((type) => [
          type, set.members.filter((member) => member.type === type).length,
        ]),
      );
      return {
        type: 'set', id: set.id, name: set.name, createdAt: set.createdAt,
        memberCount: set.members.length, counts,
        preview: set.members.slice(0, previewLimit).map(
          (member) => this.#projectSubject(member, 'compact', excerptLimit, previewLimit),
        ),
      };
    }
    if (item.type === 'run') {
      const run = this.getRun(item.id);
      if (mode === 'full') return { type: 'run', ...run };
      return {
        type: 'run', id: run.id, operation: run.operation, status: run.status,
        startedAt: run.startedAt, finishedAt: run.finishedAt, inputs: run.inputs,
        outcomeCounts: run.operation === 'acquisition'
          ? run.diagnostics.reduce((counts, diagnostic) => {
              counts[diagnostic.outcome] = (counts[diagnostic.outcome] ?? 0) + 1;
              return counts;
            }, {})
          : { results: run.results.length, diagnostics: run.diagnostics.length },
        preview: run.results.slice(0, previewLimit).map(
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
    const created = this.createSet(name);
    for (const member of selected) {
      const sources = [
        ...(left.members.some((candidate) => memberKey(candidate) === memberKey(member))
          ? [{ setId: left.id, reasons: left.members.find((candidate) => memberKey(candidate) === memberKey(member)).reasons }]
          : []),
        ...(right.members.some((candidate) => memberKey(candidate) === memberKey(member))
          ? [{ setId: right.id, reasons: right.members.find((candidate) => memberKey(candidate) === memberKey(member)).reasons }]
          : []),
      ];
      this.addSetMember(created.id, member, {
        type: 'set-operation', operation, leftSetId, rightSetId, sources,
      });
    }
    return this.getSet(created.id);
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

  close() {
    if (!this.#closed) {
      this.#database.close();
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

function allEventRecords(database) {
  return database
    .prepare('SELECT event_id, raw_event FROM events ORDER BY event_id')
    .all()
    .map((row) => {
      const event = JSON.parse(row.raw_event);
      return {
        event,
        observations: database
          .prepare(
            'SELECT observation_id, relay, observed_at FROM observations WHERE event_id = ? ORDER BY observation_id',
          )
          .all(row.event_id)
          .map((observation) => ({
            id: Number(observation.observation_id),
            relay: observation.relay,
            observedAt: observation.observed_at,
          })),
      };
    });
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

function resolvePrefixes(prefixes, candidates, label) {
  if (!prefixes) return null;
  const resolved = new Set();
  for (const prefix of prefixes) {
    const matches = candidates.filter((candidate) => candidate.startsWith(prefix));
    if (matches.length > 1) {
      throw new ResearchMemoryError(`Ambiguous ${label} prefix ${prefix}: ${matches.length} stored values match.`);
    }
    if (matches.length === 1) resolved.add(matches[0]);
  }
  return resolved;
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

function compareReplaceable(left, right) {
  return right.event.created_at - left.event.created_at
    || left.event.id.localeCompare(right.event.id);
}

function currentMetadata(records) {
  return records.sort(compareReplaceable)[0] ?? null;
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
      ...(item.record ? { record: item.record } : {}),
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
  const records = allEventRecords(database);
  const metadata = currentMetadata(records.filter(
    ({ event }) => event.kind === 0 && event.pubkey === publicKey,
  ));
  const profile = metadata ? parseProfile(metadata.event) : {};
  const observations = records
    .filter(({ event }) => event.pubkey === publicKey)
    .flatMap((record) => record.observations);
  return {
    publicKey,
    name: profile.name,
    displayName: profile.display_name,
    nip05: profile.nip05,
    descriptionExcerpt: typeof profile.about === 'string'
      ? excerpt(profile.about, excerptLimit) : undefined,
    metadataEventId: metadata?.event.id,
    relays: distinctRelays(observations),
  };
}

function normalizeProjectionLimit(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 1000) {
    throw new ResearchMemoryError(`${label} must be an integer from 1 to 1000.`);
  }
  return value;
}

function buildNavigation(subjectType, subjectId, subject, records) {
  const byId = new Map(records.map((record) => [record.event.id, record]));
  const evidencedAccounts = new Set(records.flatMap(({ event }) => [
    event.pubkey,
    ...event.tags
      .filter((tag) => tag[0].toLowerCase() === 'p' && EVENT_ID.test(tag[1]))
      .map((tag) => tag[1]),
  ]));
  const metadataByAuthor = new Map();
  for (const record of records) {
    if (record.event.kind !== 0) continue;
    const existing = metadataByAuthor.get(record.event.pubkey);
    if (!existing || compareReplaceable(record, existing) < 0) {
      metadataByAuthor.set(record.event.pubkey, record);
    }
  }
  const relationships = [];
  for (const record of records) {
    for (const relation of eventRelationships(record.event)) {
      const outbound = subjectType === 'event' && record.event.id === subjectId;
      const inbound = relation.targetType === subjectType && relation.targetId === subjectId;
      if (!outbound && !inbound) continue;
      const targetRecord = relation.targetType === 'event' ? byId.get(relation.targetId) : undefined;
      const targetMetadata = relation.targetType === 'account'
        ? metadataByAuthor.get(relation.targetId)
        : undefined;
      relationships.push({
        direction: outbound ? 'outbound' : 'inbound',
        type: relation.type,
        sourceEventId: record.event.id,
        target: {
          type: relation.targetType,
          id: relation.targetId,
          resolved: relation.targetType === 'event'
            ? Boolean(targetRecord)
            : relation.targetType === 'account'
              ? evidencedAccounts.has(relation.targetId)
              : true,
        },
        evidence: relation.evidence,
        sourceEvent: record,
        ...(targetRecord ? { targetEvent: targetRecord } : {}),
        ...(targetMetadata ? {
          targetAccount: accountResult(relation.targetId, targetMetadata, []),
        } : {}),
      });
    }
  }
  relationships.sort((left, right) => (
    left.direction.localeCompare(right.direction)
    || left.sourceEventId.localeCompare(right.sourceEventId)
    || left.type.localeCompare(right.type)
    || left.target.id.localeCompare(right.target.id)
  ));
  return {
    subject: subjectType === 'event'
      ? { type: 'event', id: subjectId, record: subject }
      : {
          type: 'account',
          id: subjectId,
          ...(metadataByAuthor.has(subjectId)
            ? { account: accountResult(subjectId, metadataByAuthor.get(subjectId), []) }
            : {}),
        },
    relationships,
  };
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
    } else if (['p', 'P'].includes(tag[0]) && EVENT_ID.test(tag[1])) {
      relationships.push(tagRelationship(
        'mentioned-account', 'account', tag[1], tag, index,
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
