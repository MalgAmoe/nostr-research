import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
  openResearchMemory,
  subject,
} from '@nostr-research/memory';

const ALICE_KEY = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_KEY);
const bob = getPublicKey(BOB_KEY);
const absent = 'd'.repeat(64);
const observation = {
  relay: 'wss://evidence.example',
  observedAt: '2026-07-26T10:00:00.000Z',
};

test('in-process memory matches the SQLite oracle across the research surface', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-in-memory-parity-'));
  const sqlite = openResearchMemory(join(directory, 'oracle.sqlite'));
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  const metadataOld = sign(0, 10, [], '{"name":"old"}', ALICE_KEY);
  const metadata = sign(
    0, 20, [],
    '{"name":"shared","display_name":"Alice","nip05":"alice@example.test","about":"Research profile description"}',
    ALICE_KEY,
  );
  const bobMetadata = sign(0, 15, [], '{"name":"shared","display_name":"Bob"}', BOB_KEY);
  const root = sign(1, 30, [['t', 'research']], 'root evidence', ALICE_KEY);
  const reply = sign(1, 40, [
    ['e', root.id, '', 'root'], ['e', root.id, '', 'reply'], ['p', alice],
  ], 'reply evidence', BOB_KEY);
  const contacts = sign(3, 50, [['p', bob], ['p', absent]], '', ALICE_KEY);
  const parameterizedWithoutIdentifier = sign(
    30001, 60, [], 'default parameterized event', ALICE_KEY,
  );
  const events = [
    metadataOld, metadata, bobMetadata, root, reply, contacts, parameterizedWithoutIdentifier,
  ];

  try {
    for (const event of events) {
      sqlite.ingest(event, observation);
      memory.ingest(event, observation);
    }
    sqlite.ingest(reply, { ...observation, relay: 'wss://second.example' });
    memory.ingest(reply, { ...observation, relay: 'wss://second.example' });
    sqlite.ingest(root, { ...observation, relay: 'wss://authored-event.example' });
    memory.ingest(root, { ...observation, relay: 'wss://authored-event.example' });

    assert.deepEqual(
      memory.searchEvents({
        authors: [bob.slice(0, 12)], kinds: [1], text: ['reply'], order: 'oldest',
      }),
      sqlite.searchEvents({
        authors: [bob.slice(0, 12)], kinds: [1], text: ['reply'], order: 'oldest',
      }),
    );
    assert.deepEqual(memory.resolve('alice@example.test'), sqlite.resolve('alice@example.test'));
    assert.deepEqual(memory.searchAccounts({ text: ['ali'] }), sqlite.searchAccounts({ text: ['ali'] }));
    assert.throws(
      () => memory.resolve('shared'),
      (error) => {
        assert.throws(() => sqlite.resolve('shared'), { message: error.message });
        return /Ambiguous stored account identifier/.test(error.message);
      },
    );
    assert.deepEqual(memory.currentEvent(alice, 0), sqlite.currentEvent(alice, 0));
    assert.deepEqual(memory.currentEvent(alice, 30001), sqlite.currentEvent(alice, 30001));
    assert.deepEqual(memory.follows(alice), sqlite.follows(alice));

    const traversalOptions = {
      relationshipTypes: ['reply-root', 'reply-parent', 'author', 'mentioned-account'],
      direction: 'both', depth: 2, limit: 20,
    };
    assert.deepEqual(
      memory.traverse([subject('event', reply.id)], traversalOptions),
      sqlite.traverse([subject('event', reply.id)], traversalOptions),
    );
    assert.deepEqual(memory.thread(root.id), sqlite.thread(root.id));
    assert.deepEqual(
      memory.project(memory.select({ ids: [root.id] }), { mode: 'full' }),
      sqlite.project(sqlite.select({ ids: [root.id] }), { mode: 'full' }),
    );
    const projectionSubjects = [
      { subject: subject('account', alice) },
      { subject: subject('event', root.id) },
    ];
    const memoryProjection = memory.project(
      memory.collection(projectionSubjects, { operation: 'projection-parity' }),
      { mode: 'compact', excerptLimit: 12 },
    );
    const sqliteProjection = sqlite.project(
      sqlite.collection(projectionSubjects, { operation: 'projection-parity' }),
      { mode: 'compact', excerptLimit: 12 },
    );
    assert.deepEqual(memoryProjection, sqliteProjection);
    assert.equal(memoryProjection.results[0].descriptionExcerpt, 'Research pr…');
    assert.deepEqual(memoryProjection.results[0].relays, [
      'wss://authored-event.example', 'wss://evidence.example',
    ]);
    assert.equal(memoryProjection.results[1].author.descriptionExcerpt, 'Research pr…');
    assert.deepEqual(
      memoryProjection.results[1].author.relays,
      memoryProjection.results[0].relays,
    );

    const query = memory.searchEvents({ ids: [reply.id] });
    const runInput = {
      operation: 'event-query', inputs: query.query,
      startedAt: '2026-07-26T10:01:00Z', finishedAt: '2026-07-26T10:01:01Z',
      status: 'completed', diagnostics: [],
      results: query.results.map((item) => ({
        type: 'event', id: item.event.id,
        reasons: item.matchReasons, provenance: item.observations,
      })),
    };
    const memoryRun = memory.recordRun(runInput);
    const sqliteRun = sqlite.recordRun(runInput);
    assert.deepEqual(withoutId(memoryRun), withoutId(sqliteRun));
    assert.deepEqual(withoutId(memory.listRuns()[0]), withoutId(sqlite.listRuns()[0]));

    const memorySet = memory.createSetFromRun('selected', memoryRun.id);
    const sqliteSet = sqlite.createSetFromRun('selected', sqliteRun.id);
    assert.deepEqual(withoutId(memorySet), withoutId(sqliteSet));
    const memoryExpanded = memory.expandSet(memorySet.id, 'parents', {
      relationshipTypes: ['reply-parent'], direction: 'outbound',
    });
    const sqliteExpanded = sqlite.expandSet(sqliteSet.id, 'parents', {
      relationshipTypes: ['reply-parent'], direction: 'outbound',
    });
    assert.deepEqual(
      withoutSetReferences(memory.getSet(memoryExpanded.id), memorySet.id),
      withoutSetReferences(sqlite.getSet(sqliteExpanded.id), sqliteSet.id),
    );

    const memoryRetained = memory.retain(memory.collection([{
      subject: subject('event', root.id),
    }], { operation: 'manual-checkpoint' }), 'retained');
    const sqliteRetained = sqlite.retain(sqlite.collection([{
      subject: subject('event', root.id),
    }], { operation: 'manual-checkpoint' }), 'retained');
    assert.deepEqual(
      normalizeSet(memory.getSet(memoryRetained.id), [[memoryRetained.id, '<retained>']]),
      normalizeSet(sqlite.getSet(sqliteRetained.id), [[sqliteRetained.id, '<retained>']]),
    );
    assert.equal(memory.getSet(memoryRetained.id).members[0].reasons[0].type, 'retained-result');

    for (const operation of ['union', 'intersection', 'difference']) {
      const memoryCombined = memory.combineSets(
        operation, memorySet.id, memoryRetained.id, `${operation}-result`,
      );
      const sqliteCombined = sqlite.combineSets(
        operation, sqliteSet.id, sqliteRetained.id, `${operation}-result`,
      );
      assert.deepEqual(
        normalizeSet(memory.getSet(memoryCombined.id), [
          [memoryCombined.id, '<combined>'], [memorySet.id, '<left>'],
          [memoryRetained.id, '<right>'], [memoryRun.id, '<run>'],
        ]),
        normalizeSet(sqlite.getSet(sqliteCombined.id), [
          [sqliteCombined.id, '<combined>'], [sqliteSet.id, '<left>'],
          [sqliteRetained.id, '<right>'], [sqliteRun.id, '<run>'],
        ]),
      );
    }

    const acquired = memory.getEvent(reply.id).observations;
    const coverageInput = {
      requested: { relays: ['wss://evidence.example'], filter: { ids: [reply.id] } },
      budget: { timeoutMs: 100, eventLimit: 10, concurrency: 1 },
      startedAt: '2026-07-26T10:02:00Z', finishedAt: '2026-07-26T10:02:01Z',
      completionReason: 'eose',
      relays: [{
        relay: 'wss://evidence.example', contacted: true, outcome: 'eose',
        received: 1, invalid: 0, duplicate: 0, newlyStored: 1,
        observations: 1, diagnostic: null,
      }],
      acquiredObservations: [{ eventId: reply.id, observations: [acquired[0]] }],
    };
    const memoryCoverage = memory.recordAcquisitionCoverage(coverageInput);
    const sqliteCoverage = sqlite.recordAcquisitionCoverage(coverageInput);
    assert.deepEqual(withoutId(memoryCoverage), withoutId(sqliteCoverage));
  } finally {
    memory.close();
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('mixed ingestion and FIFO eviction leave coherent public indexes and source edges', () => {
  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const target = sign(1, 10, [['q', absent]], 'target', ALICE_KEY);
  const retainedSource = sign(1, 20, [['q', target.id]], 'retained source', BOB_KEY);
  const newest = sign(1, 30, [], 'newest', ALICE_KEY);
  const callerOwned = structuredClone(target);
  try {
    memory.ingest(callerOwned, observation);
    callerOwned.content = 'mutated after ingestion';
    memory.ingest(retainedSource, observation);
    const retained = memory.retain(memory.select({ ids: [target.id] }), 'eviction-safe reference');
    memory.ingest(retainedSource, { ...observation, relay: 'wss://duplicate.example' });
    memory.ingest(newest, observation);

    assert.deepEqual(memory.summary(), { events: 2, observations: 3 });
    assert.equal(memory.getEvent(target.id), null);
    assert.equal(memory.searchEvents({ text: ['target'] }).results.length, 0);
    assert.deepEqual(memory.resolve(target.id, 'event'), subject('event', target.id));
    assert.equal(memory.describe().evictions, 1);
    assert.deepEqual(memory.inspect(subject('event', target.id)), {
      subject: subject('event', target.id),
      resident: false,
      evidence: null,
      provenance: [],
      relationships: [],
    });
    const continued = memory.traverse([subject('set', retained.id)], {
      relationshipTypes: ['quoted-event'], direction: 'outbound', depth: 1,
    });
    assert.ok(continued.items.some(({ subject: item }) => item.id === target.id));

    const inboundFromMissingTarget = memory.traverse([subject('event', retainedSource.id)], {
      relationshipTypes: ['quoted-event'], direction: 'outbound', depth: 1,
    });
    assert.ok(inboundFromMissingTarget.items.some(
      ({ subject: item }) => item.type === 'event' && item.id === target.id,
    ));
    assert.equal(memory.project(inboundFromMissingTarget, { mode: 'full' }).results
      .find(({ id }) => id === target.id).resolved, false);

    const returned = memory.getEvent(retainedSource.id);
    returned.event.content = 'public mutation';
    returned.observations.push({ id: 999 });
    assert.equal(memory.getEvent(retainedSource.id).event.content, 'retained source');
    assert.equal(memory.getEvent(retainedSource.id).observations.length, 2);
    assert.ok(!memory.traverse([subject('event', retainedSource.id)], {
      relationshipTypes: ['quoted-event'], direction: 'outbound', depth: 2,
    }).items.some(({ subject: item }) => item.id === absent));
  } finally {
    memory.close();
  }
});

function sign(kind, createdAt, tags, content, key) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, key);
}

function withoutId(value) {
  const copy = structuredClone(value);
  delete copy.id;
  delete copy.createdAt;
  return copy;
}

function withoutSetReferences(value, sourceSetId) {
  const copy = JSON.parse(JSON.stringify(withoutId(value)).replaceAll(sourceSetId, '<set>'));
  delete copy.createdAt;
  return copy;
}

function normalizeSet(value, replacements) {
  let serialized = JSON.stringify(withoutId(value));
  for (const [id, replacement] of replacements) serialized = serialized.replaceAll(id, replacement);
  const copy = JSON.parse(serialized);
  delete copy.createdAt;
  return copy;
}
