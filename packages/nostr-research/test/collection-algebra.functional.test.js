import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
  executeResearchPlan,
  ResearchMemoryError,
} from '@nostr-research/memory';

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

test('bounded groups expose exact membership, refresh evidence, and summarize exact counts', () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  try {
    const notes = [2, 3, 4].map((created_at) => signed(ALICE_SECRET, {
      kind: 1, created_at, tags: [], content: `note ${created_at}`,
    }));
    for (const event of notes) {
      memory.ingest(event, {
        relay: 'wss://one.example/', observedAt: '2026-07-26T10:00:00.000Z',
      });
    }
    const grouped = memory.transform(memory.select({ kinds: [1] }), {
      operation: 'group', by: 'event.author', itemLimit: 1,
    });
    assert.deepEqual({
      memberCount: grouped.items[0].memberCount,
      retainedMemberCount: grouped.items[0].retainedMemberCount,
      omittedMemberCount: grouped.items[0].omittedMemberCount,
      truncated: grouped.items[0].truncated,
    }, {
      memberCount: 3, retainedMemberCount: 1, omittedMemberCount: 2, truncated: true,
    });

    memory.ingest(grouped.items[0].items[0].record.event, {
      relay: 'wss://two.example/', observedAt: '2026-07-26T10:01:00.000Z',
    });
    const summary = memory.transform(grouped, {
      operation: 'summarize',
      aggregations: [
        { name: 'count', operation: 'count' },
        { name: 'relays', operation: 'collect', field: 'observedRelay', limit: 5 },
      ],
    });
    assert.equal(summary.items[0].values.count, 3);
    assert.deepEqual(summary.items[0].values.relays, [
      'wss://one.example/', 'wss://two.example/',
    ]);
    assert.throws(() => memory.transform(grouped, {
      operation: 'summarize',
      aggregations: [
        { name: ' count ', operation: 'count' },
        { name: 'count', operation: 'count' },
      ],
    }), /Duplicate summary aggregation name: count/);
  } finally {
    memory.close();
  }
});

test('a local-only named plan can query resident memory without implicit acquisition', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 5 });
  try {
    const report = await executeResearchPlan(memory, [
      {
        id: 'resident-notes',
        operation: 'select',
        parameters: { kinds: [1], limit: 5 },
      },
      {
        id: 'resident-only',
        operation: 'filter',
        input: 'resident-notes',
        parameters: { where: { field: 'evidence.resident', equals: true }, limit: 5 },
      },
    ]);
    assert.deepEqual(report.stages.map(({ resultKind }) => resultKind), ['events', 'events']);
    assert.deepEqual(report.stages[1].result.items, []);
    await assert.rejects(
      executeResearchPlan(memory, [
        { id: 'later', operation: 'move', input: 'missing', parameters: { to: 'authors' } },
      ]),
      /input must name an earlier stage/,
    );
    await assert.rejects(
      executeResearchPlan(memory, [
        {
          id: 'external',
          operation: 'acquire',
          parameters: {
            relays: ['wss://relay.invalid'],
            filter: { kinds: [1] },
            timeoutMs: 1_000,
            observationLimit: 1,
            distinctEventLimit: 1,
          },
        },
        {
          id: 'invalid-retention',
          operation: 'retain',
          input: 'external',
          parameters: { name: 'invalid', options: { reason: 'caller supplied' } },
        },
      ]),
      /reason requires a non-empty type/,
    );
    await assert.rejects(
      executeResearchPlan(memory, [
        { id: 'resident', operation: 'select', parameters: { kinds: [1] } },
        {
          id: 'misleading',
          operation: 'select',
          input: 'resident',
          parameters: { kinds: [1] },
        },
      ]),
      /input must name an acquisition stage/,
    );
    assert.equal(memory.describe().eventCount, 0);
  } finally {
    memory.close();
  }
});
