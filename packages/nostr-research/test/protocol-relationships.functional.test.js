import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  continueResearch,
  createInMemoryResearchMemory,
  subject,
} from '@nostr-research/memory';

const ALICE_KEY = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('2'.repeat(64), 'hex'));
const CAROL_KEY = Uint8Array.from(Buffer.from('3'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_KEY);
const bob = getPublicKey(BOB_KEY);
const carol = getPublicKey(CAROL_KEY);
const unresolved = 'd'.repeat(64);

test('mixed event kinds derive truthful references without polluting conversations', async () => {
  const root = sign(1, 10, [], 'root', ALICE_KEY);
  const reply = sign(
    1, 20,
    [['e', root.id, '', 'root'], ['p', alice]],
    'reply',
    BOB_KEY,
  );
  const comment = sign(
    1111, 30,
    [
      ['E', root.id, '', alice],
      ['e', reply.id, '', bob],
      ['P', alice],
      ['p', bob],
    ],
    'comment',
    CAROL_KEY,
  );
  const repost = sign(
    6, 40,
    [['e', root.id, 'wss://evidence.example'], ['p', alice]],
    JSON.stringify(root),
    CAROL_KEY,
  );
  const reaction = sign(
    7, 50,
    [['e', root.id, 'wss://evidence.example'], ['p', alice], ['k', '1']],
    '+',
    BOB_KEY,
  );
  const unresolvedReaction = sign(
    7, 55,
    [['e', unresolved, 'wss://evidence.example'], ['k', '1']],
    '-',
    BOB_KEY,
  );
  const deletion = sign(
    5, 60,
    [['e', root.id], ['k', '1']],
    'published by accident',
    ALICE_KEY,
  );
  const mention = sign(1, 70, [['p', bob]], 'hello bob', CAROL_KEY);
  const quote = sign(1, 80, [['q', root.id]], 'quoted root', CAROL_KEY);
  const externalReaction = sign(
    17, 90,
    [['k', 'web'], ['i', 'https://example.test/research']],
    '⭐',
    BOB_KEY,
  );
  const file = sign(1063, 100, [], 'file metadata', ALICE_KEY);
  const genericRepost = sign(
    16, 110,
    [['e', file.id, 'wss://evidence.example'], ['k', '1063']],
    JSON.stringify(file),
    CAROL_KEY,
  );
  const events = [
    root, reply, comment, repost, reaction, unresolvedReaction, deletion, mention, quote,
    externalReaction, file, genericRepost,
  ];
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    for (const event of events) {
      memory.ingest(event, {
        relay: 'wss://evidence.example',
        observedAt: '2026-07-28T10:00:00.000Z',
      });
    }

    const conversation = memory.traverse([subject('event', root.id)], {
      relationshipTypes: ['reply-root', 'reply-parent'],
      direction: 'both',
      depth: 3,
      limit: 20,
    });
    assert.deepEqual(
      conversation.items
        .filter(({ role }) => role !== 'seed')
        .map(({ subject: item }) => item.id)
        .sort(),
      [reply.id, comment.id].sort(),
    );

    assertRelationship(memory, repost, 'repost-target', root.id, ['e', root.id, 'wss://evidence.example']);
    assertRelationship(memory, reaction, 'reaction-target', root.id, ['e', root.id, 'wss://evidence.example']);
    assertRelationship(memory, deletion, 'deletion-target', root.id, ['e', root.id]);
    const genericRepostTarget = memory.inspect(subject('event', genericRepost.id)).relationships
      .find(({ type, target }) => type === 'repost-target' && target.id === file.id);
    assert.ok(genericRepostTarget);
    assert.deepEqual(genericRepostTarget.evidence, {
      interpretation: 'known',
      protocol: 'NIP-18',
      field: 'content',
    });
    assertRelationship(
      memory,
      externalReaction,
      'reaction-target',
      'i:https://example.test/research',
      ['i', 'https://example.test/research'],
    );
    assertRelationship(memory, mention, 'mentioned-account', bob, ['p', bob]);
    assertRelationship(memory, quote, 'quoted-event', root.id, ['q', root.id]);
    assertRelationship(memory, comment, 'comment-root-author', alice, ['P', alice]);
    assertRelationship(memory, comment, 'comment-parent-author', bob, ['p', bob]);

    for (const event of [repost, reaction, unresolvedReaction, deletion, genericRepost]) {
      assert.ok(!memory.inspect(subject('event', event.id)).relationships.some(
        ({ type }) => ['reply-root', 'reply-parent'].includes(type),
      ));
    }

    const sources = memory.select({
      ids: [repost.id, reaction.id, unresolvedReaction.id, deletion.id, genericRepost.id],
      limit: 10,
    });
    const moved = memory.transform(sources, {
      operation: 'move',
      to: 'referencedEvents',
      limit: 10,
    });
    assert.deepEqual(
      moved.items.map(({ subject: item }) => item.id).sort(),
      [root.id, file.id, unresolved].sort(),
    );
    assert.ok(moved.items.every(({ reasons }) => (
      reasons.some(({ type }) => type === 'relationship')
      && reasons.some(({ type }) => type === 'collection-move')
    )));

    const continued = await continueResearch(memory, sources, {
      relationship: 'referenced-events',
      source: 'local',
      eventLimit: 10,
    });
    assert.deepEqual(
      continued.collection.items.map(({ subject: item }) => item.id).sort(),
      [root.id, file.id, unresolved].sort(),
    );
    assert.equal(
      continued.completeness.inputs.find(({ subject: item }) => (
        item.id === unresolvedReaction.id
      )).status,
      'matched',
    );
    assert.equal(memory.inspect(subject('event', unresolved)).resolved, false);

    const cancelled = new AbortController();
    cancelled.abort();
    const relayBacked = await continueResearch(memory, sources, {
      relationship: 'referenced-events',
      source: 'relays',
      relays: ['wss://fixture.invalid/'],
      eventLimit: 10,
      signal: cancelled.signal,
    });
    assert.deepEqual(
      relayBacked.requested.filter.ids.sort(),
      [root.id, file.id, unresolved].sort(),
    );
  } finally {
    memory.close();
  }
});

test('replaceable selection and follow interpretation remain stable in one process', () => {
  const contactOld = sign(3, 100, [['p', carol]], 'old contacts', ALICE_KEY);
  const contactCurrent = sign(
    3, 200, [['p', bob, 'wss://relay.example'], ['p', unresolved]], 'current contacts', ALICE_KEY,
  );
  const mention = sign(1, 210, [['p', bob]], 'ordinary mention', ALICE_KEY);
  const bobContacts = sign(3, 220, [['p', unresolved], ['p', carol]], 'bob contacts', BOB_KEY);
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
    contactOld, contactCurrent, mention, bobContacts, relayListA, relayListB,
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

    const contactRelationships = memory.traverse([subject('event', contactCurrent.id)], {
      relationshipTypes: ['follow', 'mentioned-account'], direction: 'outbound', depth: 1,
    }).context.relationships;
    assert.deepEqual(
      contactRelationships.filter(({ type }) => type === 'follow').map(({ target }) => target.id),
      [bob, unresolved],
    );
    assert.ok(!contactRelationships.some(({ type }) => type === 'mentioned-account'));
    assert.ok(memory.traverse([subject('event', mention.id)], {
      relationshipTypes: ['follow', 'mentioned-account'], direction: 'outbound', depth: 1,
    }).context.relationships.some(({ type, target }) => (
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

    assert.deepEqual(
      memory.follows(alice).items.map(({ subject: item }) => item.id),
      [bob, unresolved],
    );
    const seeds = memory.collection([
      { subject: subject('account', alice), reasons: [], provenance: [] },
      { subject: subject('account', bob), reasons: [], provenance: [] },
    ], { operation: 'technical-seeds' });
    const connections = memory.connections(seeds, {
      relationshipTypes: ['follow'],
      minimumSources: 2,
    });
    assert.deepEqual(connections.items.map(({ subject: item }) => item.id), [unresolved]);
    assert.equal(connections.items[0].reasons[0].sourceCount, 2);
    assert.deepEqual(
      connections.items[0].reasons[0].sources.map(({ seed }) => seed.id).sort(),
      [alice, bob].sort(),
    );
    assert.deepEqual(
      connections.items[0].provenance.map(({ relay }) => relay),
      ['wss://evidence.example', 'wss://evidence.example'],
    );
    assert.deepEqual(
      memory.select({ authors: [alice], kinds: [3], limit: 10 })
        .items.map(({ subject: item }) => item.id).sort(),
      [contactOld.id, contactCurrent.id].sort(),
    );
    assert.equal(memory.getEvent(contactOld.id).event.content, 'old contacts');
    assert.equal(memory.currentEvent(alice, 3).event.id, contactCurrent.id);
    assert.deepEqual(
      memory.follows(alice).items.map(({ subject: item }) => item.id),
      [bob, unresolved],
    );
  } finally {
    memory?.close();
  }
});

function sign(kind, createdAt, tags, content, key) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, key);
}

function assertRelationship(memory, sourceEvent, type, targetId, tag) {
  const relationship = memory.inspect(subject('event', sourceEvent.id)).relationships
    .find((candidate) => candidate.type === type && candidate.target.id === targetId);
  assert.ok(relationship, `${type} relationship should target ${targetId}.`);
  assert.deepEqual(relationship.evidence.tag, tag);
  assert.deepEqual(sourceEvent.tags[relationship.evidence.tagIndex], tag);
}
