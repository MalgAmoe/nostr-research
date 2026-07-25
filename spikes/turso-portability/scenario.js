export const SCHEMA = `
  PRAGMA foreign_keys = ON;

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
    event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    relay TEXT NOT NULL,
    observed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_relationships (
    source_event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    evidence TEXT NOT NULL,
    PRIMARY KEY (source_event_id, relationship_type, target_type, target_id, evidence)
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

  CREATE INDEX IF NOT EXISTS events_by_created_at
    ON events(CAST(json_extract(raw_event, '$.created_at') AS INTEGER), event_id);

  CREATE INDEX IF NOT EXISTS events_by_author_kind_created
    ON events(
      json_extract(raw_event, '$.pubkey'),
      CAST(json_extract(raw_event, '$.kind') AS INTEGER),
      CAST(json_extract(raw_event, '$.created_at') AS INTEGER),
      event_id
    );
`;

const DEFAULT_EVENT_COUNT = 1_000;
const AUTHOR_COUNT = 25;

export async function runScenario(
  connect,
  databasePath,
  runtime,
  { eventCount = DEFAULT_EVENT_COUNT, onProgress = () => {} } = {},
) {
  const startedAt = clock();
  onProgress('connecting');
  const database = await connect(databasePath);
  const openedAt = clock();

  try {
    onProgress('creating schema');
    await database.exec(SCHEMA);
    await database.exec(`
      DELETE FROM observations;
      DELETE FROM event_relationships;
      DELETE FROM research_set_members;
      DELETE FROM research_sets;
      DELETE FROM events;
      DELETE FROM schema_metadata;
    `);
    await database.run(
      'INSERT INTO schema_metadata(key, value) VALUES (?, ?)',
      'schema_version',
      'spike-1',
    );
    const schemaReadyAt = clock();

    onProgress('building corpus batch');
    const statements = [];
    for (let index = 0; index < eventCount; index += 1) {
      const eventId = hex(index + 1);
      const author = hex((index % AUTHOR_COUNT) + 10_000);
      const event = {
        id: eventId,
        pubkey: author,
        kind: 1,
        created_at: 1_750_000_000 + index,
        content: `portable research event ${index}`,
        tags: index % 10 === 0 ? [['t', 'nostr']] : [],
        sig: '0'.repeat(128),
      };
      statements.push({
        sql: 'INSERT INTO events(event_id, raw_event) VALUES (?, ?)',
        args: [eventId, JSON.stringify(event)],
      }, {
        sql: 'INSERT INTO observations(event_id, relay, observed_at) VALUES (?, ?, ?)',
        args: [
          eventId,
          index % 2 === 0 ? 'wss://relay.one' : 'wss://relay.two',
          new Date((1_750_000_000 + index) * 1_000).toISOString(),
        ],
      });
      if (index > 0 && index % 5 === 0) {
        statements.push({
          sql: `INSERT INTO event_relationships
            (source_event_id, relationship_type, target_type, target_id, evidence)
            VALUES (?, 'reply-parent', 'event', ?, ?)`,
          args: [eventId, hex(index), JSON.stringify({ tag: 'e' })],
        });
      }
    }
    onProgress(`writing ${statements.length} statements`);
    for (let offset = 0; offset < statements.length; offset += 100) {
      await database.batch(statements.slice(offset, offset + 100));
    }
    const corpusReadyAt = clock();

    onProgress('querying and checking');
    const latest = await database.all(`
      SELECT
        event_id,
        json_extract(raw_event, '$.pubkey') AS pubkey,
        CAST(json_extract(raw_event, '$.created_at') AS INTEGER) AS created_at
      FROM events
      WHERE json_extract(raw_event, '$.kind') = 1
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const grouped = await database.all(`
      SELECT
        json_extract(raw_event, '$.pubkey') AS pubkey,
        COUNT(*) AS event_count
      FROM events
      GROUP BY pubkey
      ORDER BY event_count DESC, pubkey
      LIMIT 5
    `);

    await database.run(
      'INSERT INTO research_sets(set_id, name, created_at) VALUES (?, ?, ?)',
      'portable-set',
      'Portable findings',
      new Date().toISOString(),
    );
    const retain = database.transactionAsync(async (transaction) => {
      for (const row of latest.slice(0, 10)) {
        await transaction.run(
          `INSERT INTO research_set_members(set_id, entity_type, entity_id)
           VALUES ('portable-set', 'event', ?)`,
          row.event_id,
        );
      }
    });
    await retain();

    let foreignKeyRejected = false;
    try {
      await database.run(
        `INSERT INTO observations(event_id, relay, observed_at)
         VALUES (?, 'wss://invalid.example', ?)`,
        'f'.repeat(64),
        new Date().toISOString(),
      );
    } catch {
      foreignKeyRejected = true;
    }

    const beforeRollback = Number((await database.get(
      'SELECT COUNT(*) AS count FROM events',
    )).count);
    const rollback = database.transactionAsync(async (transaction) => {
      await transaction.run(
        'INSERT INTO events(event_id, raw_event) VALUES (?, ?)',
        hex(eventCount + 50),
        JSON.stringify({ id: hex(eventCount + 50), created_at: 1, pubkey: hex(1), kind: 1 }),
      );
      throw new Error('intentional rollback');
    });
    try {
      await rollback();
    } catch (error) {
      if (error.message !== 'intentional rollback') throw error;
    }
    const afterRollback = Number((await database.get(
      'SELECT COUNT(*) AS count FROM events',
    )).count);

    const setMemberCount = Number((await database.get(
      `SELECT COUNT(*) AS count
       FROM research_set_members
       WHERE set_id = 'portable-set'`,
    )).count);
    const relationshipCount = Number((await database.get(
      'SELECT COUNT(*) AS count FROM event_relationships',
    )).count);
    const queryFinishedAt = clock();

    return {
      runtime,
      databasePath,
      eventCount: beforeRollback,
      observationCount: Number((await database.get(
        'SELECT COUNT(*) AS count FROM observations',
      )).count),
      relationshipCount,
      setMemberCount,
      latestFirst: latest[0],
      grouped,
      foreignKeyRejected,
      rollbackAtomic: beforeRollback === afterRollback,
      timingsMs: {
        connect: round(openedAt - startedAt),
        schema: round(schemaReadyAt - openedAt),
        insertCorpus: round(corpusReadyAt - schemaReadyAt),
        queriesAndChecks: round(queryFinishedAt - corpusReadyAt),
        total: round(queryFinishedAt - startedAt),
      },
    };
  } finally {
    await database.close();
  }
}

function hex(value) {
  return value.toString(16).padStart(64, '0');
}

function clock() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function round(value) {
  return Math.round(value * 100) / 100;
}
