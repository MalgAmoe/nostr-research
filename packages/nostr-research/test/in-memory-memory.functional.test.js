import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
    subject,
} from '@nostr-research/memory';
import { createResearchEnvironment } from '../src/console.js';

const ALICE_KEY = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_KEY);
const bob = getPublicKey(BOB_KEY);
const absent = 'd'.repeat(64);
const observation = {
  relay: 'wss://evidence.example',
  observedAt: '2026-07-26T10:00:00.000Z',
};

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

    assert.equal(memory.describe().eventCount, 2);
    assert.equal(memory.getEvent(target.id), null);
    assert.equal(memory.select({ text: ['target'] }).items.length, 0);
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

test('collections re-resolve stable subjects across observations, replacement metadata, and eviction', () => {
  const memory = createInMemoryResearchMemory({ capacity: 3 });
  const environment = createResearchEnvironment(memory);
  const note = sign(1, 10, [], 'stable note', ALICE_KEY);
  const oldMetadata = sign(0, 20, [], JSON.stringify({ name: 'old name' }), ALICE_KEY);
  const newMetadata = sign(0, 30, [], JSON.stringify({ name: 'current name' }), ALICE_KEY);
  const evictionTrigger = sign(1, 40, [], 'eviction trigger', BOB_KEY);
  const accountEvictionTrigger = sign(1, 50, [], 'account eviction trigger', BOB_KEY);
  const replacementEvictionTrigger = sign(
    1, 60, [], 'replacement eviction trigger', BOB_KEY,
  );
  try {
    memory.ingest(note, observation);
    memory.ingest(oldMetadata, observation);
    const eventCollection = memory.select({ ids: [note.id] });
    const originalReasons = structuredClone(eventCollection.items[0].reasons);
    assert.equal(eventCollection.items[0].record.observations.length, 1);
    const accountCollection = memory.lookup(subject('account', alice));

    memory.ingest(note, { ...observation, relay: 'wss://second.example' });
    memory.ingest(newMetadata, observation);

    const currentEvent = memory.project(eventCollection, { mode: 'full' }).results[0];
    assert.equal(currentEvent.observations.length, 2);
    assert.deepEqual(currentEvent.reasons, originalReasons);
    const shownCurrentEvent = environment.research.show(eventCollection, {
      includeEvidence: true,
    });
    assert.equal(shownCurrentEvent.preview[0].evidence.observationCount, 2);
    assert.equal(shownCurrentEvent.provenance.observations, 2);
    const currentAccount = memory.project(accountCollection, { mode: 'full' }).results[0];
    assert.equal(currentAccount.profile.name, 'current name');
    assert.equal(currentAccount.metadataEvent.id, newMetadata.id);
    const shownCurrentAccount = environment.research.show(accountCollection, {
      includeEvidence: true,
    });
    assert.equal(shownCurrentAccount.preview[0].resolved, true);
    assert.equal(shownCurrentAccount.preview[0].evidence.profile.name, 'current name');
    assert.equal(shownCurrentAccount.preview[0].evidence.metadataEvent.id, newMetadata.id);
    const shownCurrentAccountSubject = environment.research.show(subject('account', alice));
    assert.equal(shownCurrentAccountSubject.resident, true);
    assert.equal(shownCurrentAccountSubject.preview.resolved, true);

    memory.ingest(evictionTrigger, observation);
    assert.equal(memory.inspect(subject('event', note.id)).resident, false);
    const retainedReference = memory.project(eventCollection, { mode: 'full' }).results[0];
    assert.equal(retainedReference.resolved, false);
    assert.deepEqual(retainedReference.reasons, originalReasons);
    const shownRetainedReference = environment.research.show(eventCollection, {
      includeEvidence: true,
    });
    assert.equal(shownRetainedReference.preview[0].resolved, false);
    assert.equal(shownRetainedReference.preview[0].evidence.event, undefined);
    assert.deepEqual(shownRetainedReference.preview[0].evidence.reasons, originalReasons);
    assert.equal(shownRetainedReference.provenance.observations, 1);
    assert.equal(environment.research.show(subject('event', note.id)).resident, false);
    assert.equal(memory.lookup(subject('event', note.id)).items[0].record, undefined);

    memory.ingest(accountEvictionTrigger, observation);
    memory.ingest(replacementEvictionTrigger, observation);
    const shownEvictedAccount = environment.research.show(accountCollection, {
      includeEvidence: true,
    });
    assert.equal(shownEvictedAccount.preview[0].resolved, false);
    assert.equal(shownEvictedAccount.preview[0].evidence.profile, undefined);
    const shownEvictedAccountSubject = environment.research.show(subject('account', alice));
    assert.equal(shownEvictedAccountSubject.resident, false);
    assert.equal(shownEvictedAccountSubject.preview.resolved, false);
  } finally {
    environment.close();
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
