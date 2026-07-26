import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { createInMemoryResearchMemory, ResearchMemoryError } from '@nostr-research/memory';

const ALICE_SECRET = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));
const BOB_SECRET = Uint8Array.from(Buffer.from('2'.repeat(64), 'hex'));
const CAROL_SECRET = Uint8Array.from(Buffer.from('3'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_SECRET);
const bob = getPublicKey(BOB_SECRET);
const carol = getPublicKey(CAROL_SECRET);

function signed(secret, event) {
  return finalizeEvent(event, secret);
}

test('typed local stages refine, balance, summarize, and move trial-shaped evidence', () => {
  const aliceProfile = signed(ALICE_SECRET, {
    kind: 0, created_at: 1, tags: [],
    content: JSON.stringify({ name: 'alice', about: 'Photography and field recordings' }),
  });
  const first = signed(ALICE_SECRET, {
    kind: 1, created_at: 2, tags: [['t', 'photo'], ['p', bob]],
    content: 'A field photo https://images.example/one.jpg',
  });
  const second = signed(ALICE_SECRET, {
    kind: 1, created_at: 3, tags: [['t', 'photo']],
    content: 'Another frame https://images.example/two.webp',
  });
  const third = signed(ALICE_SECRET, {
    kind: 1, created_at: 4, tags: [['t', 'photo']],
    content: 'No attachment in this note',
  });
  const bobNote = signed(BOB_SECRET, {
    kind: 1, created_at: 5, tags: [['t', 'photo'], ['p', carol]],
    content: 'Portrait https://other.example/p.png',
  });
  const followList = signed(ALICE_SECRET, {
    kind: 3, created_at: 6, tags: [['p', bob]], content: '',
  });
  const memory = createInMemoryResearchMemory({ capacity: 30 });
  try {
    for (const event of [aliceProfile, first, second, third, bobNote, followList]) {
      memory.ingest(event, {
        relay: event === bobNote ? 'wss://two.example/' : 'wss://one.example/',
        observedAt: '2026-07-26T10:00:00.000Z',
      });
    }

    const notes = memory.select({ kinds: [1], order: 'oldest' });
    const refined = memory.transform(notes, {
      operation: 'filter', as: 'media except Carol',
      where: {
        all: [
          { field: 'event.hasMedia', equals: true },
          { not: { field: 'event.author', equals: carol } },
          { any: [
            { field: 'event.tag', name: 't', value: 'photo' },
            { field: 'event.linkedDomain', contains: 'example' },
          ] },
        ],
      },
      limit: 20,
    });
    assert.equal(refined.kind, 'events');
    assert.equal(refined.items.length, 3);
    assert.equal(refined.context.name, 'media except Carol');
    assert.doesNotThrow(() => JSON.stringify(refined));

    const grouped = memory.transform(refined, {
      operation: 'group', as: 'balanced authors', by: 'event.author', itemLimit: 2, limit: 10,
    });
    assert.equal(grouped.type, 'typed-collection');
    assert.ok(grouped.items.every(({ provenance }) => provenance.length));

    const summary = memory.transform(grouped, {
      operation: 'summarize', as: 'author evidence', limit: 10,
      aggregations: [
        { name: 'count', operation: 'count' },
        { name: 'authors', operation: 'distinct', field: 'event.author' },
        { name: 'examples', operation: 'sample', field: 'subject', limit: 1 },
        { name: 'domains', operation: 'collect', field: 'event.linkedDomain', limit: 4 },
        { name: 'oldest', operation: 'min', field: 'event.createdAt' },
        { name: 'newest', operation: 'max', field: 'event.createdAt' },
      ],
    });
    assert.equal(summary.kind, 'summaries');
    assert.deepEqual(summary.items.map(({ values }) => values.count).sort(), [1, 2]);
    const aliceSummary = summary.items.find(({ key }) => key === alice);
    assert.deepEqual(aliceSummary.values.examples, [{ type: 'event', id: first.id }]);
    assert.ok(summary.items.every(({ reasons, provenance }) => reasons.length && provenance.length));
    assert.equal(summary.context.stages.length, 3);

    const authors = memory.transform(refined, {
      operation: 'move', as: 'note authors', to: 'authors', limit: 10,
    });
    assert.equal(authors.kind, 'accounts');
    assert.deepEqual(authors.items.map(({ subject }) => subject.id), [alice, bob].sort());
    assert.ok(authors.items.every(({ reasons }) => (
      reasons.some(({ type }) => type === 'collection-move')
    )));
    const movedProvenance = authors.items.find(({ subject }) => subject.id === bob).provenance;
    const regroupedAuthors = memory.transform(authors, {
      operation: 'group', by: 'subject', limit: 10,
    });
    assert.deepEqual(
      regroupedAuthors.items.find(({ key }) => key.id === bob).provenance,
      movedProvenance,
    );

    const currentProfileEvidence = memory.transform(authors, {
      operation: 'filter',
      where: { field: 'evidence.resident', equals: true },
      limit: 10,
    });
    assert.deepEqual(currentProfileEvidence.items.map(({ subject }) => subject.id), [alice]);

    const authoredAgain = memory.transform(authors, {
      operation: 'move', to: 'authoredEvents', limit: 20,
    });
    assert.ok(authoredAgain.items.some(({ subject }) => subject.id === first.id));

    const referenced = memory.transform(refined, {
      operation: 'move', to: 'referencedAccounts', limit: 10,
    });
    assert.deepEqual(referenced.items.map(({ subject }) => subject.id), [bob, carol].sort());

    const follows = memory.transform(memory.collection([
      { subject: { type: 'account', id: alice }, reasons: [{ type: 'candidate' }] },
    ]), { operation: 'move', to: 'followedAccounts', limit: 10 });
    assert.deepEqual(follows.items.map(({ subject }) => subject.id), [bob]);
  } finally {
    memory.close();
  }
});

test('empty paths retain typed context and invalid plans fail before execution', () => {
  const memory = createInMemoryResearchMemory({ capacity: 5 });
  try {
    const empty = memory.select({ kinds: [1] });
    const moved = memory.transform(empty, [
      { operation: 'filter', as: 'nothing resident', where: {
        field: 'evidence.resident', equals: true,
      } },
      { operation: 'move', as: 'no authors', to: 'authors' },
    ]);
    assert.equal(moved.kind, 'accounts');
    assert.deepEqual(moved.items, []);
    assert.equal(moved.context.name, 'no authors');
    assert.equal(moved.context.stages.length, 2);

    assert.throws(() => memory.transform(empty, [
      { operation: 'filter', where: { field: 'event.kind', equals: 1 } },
      { operation: 'move', to: 'followedAccounts' },
    ]), (error) => error instanceof ResearchMemoryError
      && /Move from events to followedAccounts is not supported/.test(error.message));
    assert.throws(() => memory.transform(empty, {
      operation: 'filter', where: { field: 'event.quality', equals: 'good' },
    }), /Unsupported filter field/);
  } finally {
    memory.close();
  }
});
