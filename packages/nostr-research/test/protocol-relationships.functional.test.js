import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
    subject,
} from '@nostr-research/memory';
import { createResearchEnvironment } from '../src/console.js';

const ALICE_KEY = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('2'.repeat(64), 'hex'));
const CAROL_KEY = Uint8Array.from(Buffer.from('3'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_KEY);
const bob = getPublicKey(BOB_KEY);
const carol = getPublicKey(CAROL_KEY);
const unresolved = 'd'.repeat(64);

test('replaceable selection and follow interpretation remain stable in one process', () => {
  const contactOld = sign(3, 100, [['p', carol]], 'old contacts', ALICE_KEY);
  const contactCurrent = sign(
    3, 200, [['p', bob, 'wss://relay.example'], ['p', unresolved]], 'current contacts', ALICE_KEY,
  );
  const mention = sign(1, 210, [['p', bob]], 'ordinary mention', ALICE_KEY);
  const relayListA = sign(10002, 300, [['r', 'wss://a.example']], '', ALICE_KEY);
  const relayListB = sign(10002, 300, [['r', 'wss://b.example']], '', ALICE_KEY);
  const expectedRelayList = [relayListA, relayListB].sort((left, right) => (
    left.id.localeCompare(right.id)
  ))[0];
  const articleOld = sign(30023, 400, [['d', 'research']], 'old article', ALICE_KEY);
  const articleCurrent = sign(30023, 500, [['d', 'research']], 'current article', ALICE_KEY);
  const otherArticle = sign(30023, 600, [['d', 'other']], 'other address', ALICE_KEY);
  const bobMetadata = sign(0, 50, [], '{"name":"bob"}', BOB_KEY);
  const events = [
    contactOld, contactCurrent, mention, relayListA, relayListB,
    articleOld, articleCurrent, otherArticle, bobMetadata,
  ];

  let memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    for (const event of events) {
      memory.ingest(event, {
        relay: 'wss://evidence.example',
        observedAt: '2026-07-25T12:00:00.000Z',
      });
    }

    assert.equal(memory.currentEvent(alice, 3).event.id, contactCurrent.id);
    assert.equal(memory.currentEvent(subject('account', alice), 10002).event.id, expectedRelayList.id);
    assert.equal(memory.currentEvent(alice, 30023, { d: 'research' }).event.id, articleCurrent.id);
    assert.equal(memory.currentEvent(alice, 30023, { d: 'other' }).event.id, otherArticle.id);
    assert.equal(memory.currentEvent(alice, 10000), null);

    const contactRelationships = memory.relatedEvent(contactCurrent.id).relationships;
    assert.deepEqual(
      contactRelationships.filter(({ type }) => type === 'follow').map(({ target }) => target.id),
      [bob, unresolved],
    );
    assert.ok(!contactRelationships.some(({ type }) => type === 'mentioned-account'));
    assert.ok(memory.relatedEvent(mention.id).relationships.some(({ type, target }) => (
      type === 'mentioned-account' && target.id === bob
    )));

    const followed = memory.follows(alice);
    assert.deepEqual(followed.items.map(({ subject: item }) => item.id), [bob, unresolved]);
    for (const item of followed.items) {
      assert.equal(item.reasons[0].relationshipType, 'follow');
      assert.equal(item.reasons[0].sourceEventId, contactCurrent.id);
      assert.deepEqual(item.reasons[0].evidence.tag, contactCurrent.tags[
        item.reasons[0].evidence.tagIndex
      ]);
      assert.equal(item.provenance[0].relay, 'wss://evidence.example');
    }
    assert.equal(memory.follows(carol).items.length, 0);

    const environment = createResearchEnvironment(memory);
    assert.deepEqual(
      environment.research.follows(alice).items.map(({ subject: item }) => item.id),
      [bob, unresolved],
    );
    assert.deepEqual(
      memory.searchEvents({ authors: [alice], kinds: [3], limit: 10 })
        .results.map(({ event }) => event.id).sort(),
      [contactOld.id, contactCurrent.id].sort(),
    );
    assert.equal(memory.getEvent(contactOld.id).event.content, 'old contacts');
    assert.equal(memory.currentEvent(alice, 3).event.id, contactCurrent.id);
    assert.deepEqual(
      memory.follows(alice).items.map(({ subject: item }) => item.id),
      [bob, unresolved],
    );
    environment.close();
    memory = null;
  } finally {
    memory?.close();
  }
});

function sign(kind, createdAt, tags, content, key) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, key);
}
