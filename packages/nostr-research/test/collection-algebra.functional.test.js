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

test('typed local stages and composable relations refine trial-shaped evidence', async () => {
  const aliceProfile = signed(ALICE_SECRET, {
    kind: 0, created_at: 1, tags: [],
    content: JSON.stringify({
      name: 'alice', display_name: 'Alice Camera', about: 'Photography and field recordings',
    }),
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

    const picked = memory.transform(refined, {
      operation: 'pick', as: 'first and third visible results', positions: [1, 3],
    });
    assert.equal(picked.kind, 'events');
    assert.deepEqual(picked.items.map(({ subject }) => subject.id), [first.id, bobNote.id]);

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
    const projectedNames = memory.transform(authors, {
      operation: 'project',
      fields: ['account.name', 'account.display_name'],
      limit: 10,
    });
    assert.deepEqual(
      projectedNames.items.find(({ subject }) => subject.id === alice).values,
      { 'account.name': 'alice', 'account.display_name': 'Alice Camera' },
    );
    const distinctAuthors = memory.transform(refined, {
      operation: 'distinct', by: 'event.author', limit: 10,
    });
    assert.deepEqual(distinctAuthors.items.map(({ memberCount }) => memberCount).sort(), [1, 2]);
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

    const relational = await executeResearchPlan(memory, [
      { id: 'notes', operation: 'select', parameters: { scope: 'corpus', kinds: [1] } },
      { id: 'note-rows', operation: 'relate', input: 'notes', parameters: {} },
      {
        id: 'evidence', operation: 'aggregate', input: 'note-rows',
        parameters: {
          by: [{ field: 'event.author', name: 'account' }],
          aggregations: [
            { name: 'noteCount', operation: 'count' },
            { name: 'examples', operation: 'sample', field: 'event.text', limit: 2 },
          ],
        },
      },
      {
        id: 'accounts', operation: 'move', input: 'notes',
        parameters: { to: 'authors', limit: 10 },
      },
      { id: 'account-rows', operation: 'relate', input: 'accounts', parameters: {} },
      {
        id: 'candidates', operation: 'join',
        inputs: { left: 'evidence', right: 'account-rows' },
        parameters: {
          kind: 'left',
          on: { left: 'account', right: 'subject.id' },
          select: [{ field: 'account.name', name: 'name' }],
        },
      },
      {
        id: 'scored', operation: 'derive', input: 'candidates',
        parameters: {
          fields: [{
            name: 'score',
            expression: {
              operation: 'multiply',
              args: [{ field: 'noteCount' }, { constant: 2 }],
            },
          }],
        },
      },
      {
        id: 'ordered', operation: 'sort', input: 'scored',
        parameters: { by: [{ field: 'score', direction: 'descending' }] },
      },
      {
        id: 'window', operation: 'slice', input: 'ordered',
        parameters: { offset: 0, limit: 10 },
      },
    ]);
    const candidateRows = relational.stages.at(-1).result.rows;
    assert.deepEqual(candidateRows.map(({ values }) => values.noteCount), [3, 1]);
    assert.equal(candidateRows[0].values.name, 'alice');
    assert.equal(candidateRows[0].values.score, 6);
    assert.ok(candidateRows.every(({ provenance }) => provenance.length));
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
    assert.equal(summary.items[0].omissions.relays.inputComplete, true);
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
        parameters: { scope: 'corpus', kinds: [1], limit: 5 },
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
        { id: 'resident', operation: 'select', parameters: { scope: 'corpus', kinds: [1] } },
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

test('stable bounds and compatible set composition share the public pipeline algebra', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  try {
    const notes = [2, 3, 4, 5].map((created_at, index) => signed(
      index === 3 ? BOB_SECRET : ALICE_SECRET,
      { kind: 1, created_at, tags: [], content: `note ${created_at}` },
    ));
    for (const event of notes) {
      memory.ingest(event, {
        relay: 'wss://one.example/', observedAt: '2026-07-26T10:00:00.000Z',
      });
    }
    const all = memory.select({ kinds: [1], order: 'oldest' });
    const bounded = memory.transform(all, [
      { operation: 'sort', by: 'event.createdAt', direction: 'descending' },
      { operation: 'sample', seed: 'field-trial', limit: 3 },
      { operation: 'limit', limit: 2 },
    ]);
    const repeated = memory.transform(all, [
      { operation: 'sort', by: 'event.createdAt', direction: 'descending' },
      { operation: 'sample', seed: 'field-trial', limit: 3 },
      { operation: 'limit', limit: 2 },
    ]);
    assert.deepEqual(bounded.items.map(({ subject }) => subject), repeated.items.map(({ subject }) => subject));
    assert.deepEqual(bounded.context.cardinality, {
      inputCount: 3, outputCount: 2, omittedCount: 1, truncated: true,
    });

    const aliceNotes = memory.transform(all, {
      operation: 'filter', where: { field: 'event.author', equals: alice }, limit: 10,
    });
    const newest = memory.transform(all, {
      operation: 'filter', where: { field: 'event.createdAt', in: [4, 5] }, limit: 10,
    });
    const union = memory.transform(aliceNotes, {
      operation: 'union', with: newest, limit: 10,
    });
    const intersection = memory.transform(aliceNotes, {
      operation: 'intersection', with: newest, limit: 10,
    });
    const comparison = memory.transform(aliceNotes, {
      operation: 'compare', with: newest, limit: 10,
    });
    assert.equal(union.items.length, 4);
    assert.equal(intersection.items.length, 1);
    assert.deepEqual(comparison.items[0].values, {
      left: 3, right: 2, shared: 1, leftOnly: 2, rightOnly: 1,
    });

    const report = await executeResearchPlan(memory, [
      { id: 'all', operation: 'select', parameters: { scope: 'corpus', kinds: [1] } },
      {
        id: 'alice', operation: 'filter', input: 'all',
        parameters: { where: { field: 'event.author', equals: alice } },
      },
      {
        id: 'newest', operation: 'filter', input: 'all',
        parameters: { where: { field: 'event.createdAt', in: [4, 5] } },
      },
      {
        id: 'shared', operation: 'intersection', input: 'alice',
        parameters: { with: 'newest', limit: 10 },
      },
      {
        id: 'chosen', operation: 'pick', input: 'alice',
        parameters: { positions: [1, 3] },
      },
    ]);
    assert.deepEqual(
      report.stages.at(-1).result.items.map(({ subject }) => subject.id),
      [0, 2].map((position) => report.stages[1].result.items[position].subject.id),
    );
  } finally {
    memory.close();
  }
});

test('pipeline schema exposes literal fields and preflight rejects invalid composition', () => {
  const memory = createInMemoryResearchMemory({ capacity: 5 });
  try {
    const schema = memory.describeCollectionPipeline();
    assert.ok(schema.fields.accounts.includes('account.name'));
    assert.ok(schema.fields.accounts.includes('account.display_name'));
    assert.notEqual(
      schema.fields.accounts.indexOf('account.name'),
      schema.fields.accounts.indexOf('account.display_name'),
    );
    assert.deepEqual(schema.operations.filter.fieldsByInputKind.events['event.tag'], {
      valueType: 'tag[]',
      predicate: { field: 'event.tag', name: 'string', value: 'string' },
    });
    assert.equal(
      schema.operations.filter.fieldsByInputKind.events.observedRelay,
      undefined,
    );
    assert.equal(
      schema.operations.filter.fieldsByInputKind.events.subject,
      undefined,
    );
    assert.equal(
      schema.operations.filter.fieldsByInputKind.events['event.kind'].comparisons.contains,
      undefined,
    );
    assert.deepEqual(
      schema.operations.summarize.fieldsByInputKind.accounts,
      ['subject', 'subject.id', 'observedRelay'],
    );
    assert.equal(
      schema.operations.summarize.fieldsByInputKind.events.includes('event.tag'),
      false,
    );
    assert.equal(schema.operations.summarize.fieldTypes['event.createdAt'], 'number');
    assert.equal(schema.operations.summarize.aggregations.count.field, 'forbidden');
    const emptyEvents = memory.select({ kinds: [1] });
    const note = signed(ALICE_SECRET, {
      kind: 1, created_at: 7, tags: [['t', 'literal']], content: 'literal fields',
    });
    memory.ingest(note, {
      relay: 'wss://one.example/', observedAt: '2026-07-26T10:00:00.000Z',
    });
    const projected = memory.transform(memory.select({ kinds: [1] }), {
      operation: 'project', fields: ['subject', 'event.tag'],
    });
    assert.deepEqual(projected.items[0].values, {
      subject: { type: 'event', id: note.id },
      'event.tag': [{ name: 't', value: 'literal' }],
    });
    assert.doesNotThrow(() => memory.transform(memory.select({ kinds: [1] }), {
      operation: 'sort', by: 'event.tag',
    }));
    const emptyAccounts = memory.collection([{
      subject: { type: 'account', id: alice },
    }]);
    assert.throws(() => memory.transform(emptyEvents, {
      operation: 'union', with: emptyAccounts,
    }), /Incompatible union collections/);
    assert.throws(() => memory.transform(emptyEvents, [
      { operation: 'sort', by: 'event.quality' },
      { operation: 'limit', limit: 1 },
    ]), /Unsupported sort field/);
    assert.throws(() => memory.transform(emptyEvents, {
      operation: 'summarize',
      aggregations: [{ name: 'count', operation: 'count', field: 'subject' }],
    }), /count aggregation does not accept a field/);
  } finally {
    memory.close();
  }
});

test('bounded groups preserve complete derived inputs and provenance for aggregation', () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  try {
    const notes = [2, 3, 4].map((created_at, index) => signed(ALICE_SECRET, {
      kind: 1,
      created_at,
      tags: [],
      content: index === 0 ? 'https://one.example/a' : `note ${created_at}`,
    }));
    notes.forEach((event, index) => memory.ingest(event, {
      relay: `wss://${index + 1}.example/`,
      observedAt: '2026-07-26T10:00:00.000Z',
    }));
    const grouped = memory.transform(memory.select({ kinds: [1], order: 'oldest' }), {
      operation: 'group', by: 'event.author', itemLimit: 1,
    });
    assert.equal(grouped.items[0].provenance.length, 3);

    const summary = memory.transform(grouped, {
      operation: 'summarize',
      aggregations: [
        { name: 'created', operation: 'distinct', field: 'event.createdAt' },
        { name: 'oldest', operation: 'min', field: 'event.createdAt' },
        { name: 'newest', operation: 'max', field: 'event.createdAt' },
        { name: 'relays', operation: 'collect', field: 'observedRelay', limit: 10 },
      ],
    });
    assert.deepEqual(summary.items[0].values, {
      created: 3,
      oldest: 2,
      newest: 4,
      relays: ['wss://1.example/', 'wss://2.example/', 'wss://3.example/'],
    });
    for (const name of ['created', 'oldest', 'newest', 'relays']) {
      assert.deepEqual(
        {
          sourceItemsOmitted: summary.items[0].omissions[name].sourceItemsOmitted,
          inputComplete: summary.items[0].omissions[name].inputComplete,
          truncated: summary.items[0].omissions[name].truncated,
        },
        { sourceItemsOmitted: 2, inputComplete: true, truncated: false },
      );
    }
    assert.equal(summary.items[0].provenance.length, 3);
  } finally {
    memory.close();
  }
});
