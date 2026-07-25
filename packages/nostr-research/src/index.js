import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { validateEvent, verifyEvent } from 'nostr-tools';

const SCHEMA_VERSION = 1;
const EVENT_ID = /^[a-f0-9]{64}$/;
const SIGNATURE = /^[a-f0-9]{128}$/;

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

export {
  acquireRelayEvents,
  DEFAULT_ACQUISITION_EVENT_LIMIT,
  DEFAULT_ACQUISITION_TIMEOUT_MS,
  DEFAULT_RELAY_CONCURRENCY,
} from './acquire.js';
