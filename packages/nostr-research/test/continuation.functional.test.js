import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  executeResearchPlan,
} from '@nostr-research/memory';

const ALICE_SECRET = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
const BOB_SECRET = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));
const CAROL_SECRET = Uint8Array.from(Buffer.from('9'.repeat(64), 'hex'));
const DAVE_SECRET = Uint8Array.from(Buffer.from('5'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_SECRET);
const carol = getPublicKey(CAROL_SECRET);

test('named account and note handles continue with bounded relationship provenance', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  const session = createDeclarativeResearchSession(memory);
  const root = sign(1, 100, [['p', getPublicKey(BOB_SECRET)]], 'root', ALICE_SECRET);
  const other = sign(1, 110, [], 'another authored note', ALICE_SECRET);
  const reply = sign(
    1, 120, [['e', root.id, '', 'reply']], 'reply', BOB_SECRET,
  );
  const daveNote = sign(1, 130, [], 'dave note', DAVE_SECRET);
  const carolProfile = sign(
    0, 90, [], JSON.stringify({ name: 'carol' }), CAROL_SECRET,
  );
  const carolEmptyFollowList = sign(3, 95, [], '', CAROL_SECRET);
  const aliceFollowList = sign(
    3, 96, [['p', getPublicKey(BOB_SECRET)]], '', ALICE_SECRET,
  );
  for (const event of [
    root, other, reply, daveNote, carolProfile, carolEmptyFollowList, aliceFollowList,
  ]) {
    memory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-26T12:00:00.000Z',
    });
  }

  const seededRoot = await session.execute({
    commandId: 'seed-note',
    command: 'select',
    parameters: { scope: 'corpus', ids: [root.id] },
    resultId: 'root',
  });
  assert.equal(seededRoot.result.handle.kind, 'events');
  const aliceAccount = await session.execute({
    commandId: 'author-handle',
    command: 'move',
    input: 'root',
    parameters: { to: 'authors', limit: 1 },
    resultId: 'alice',
  });
  assert.equal(aliceAccount.result.handle.kind, 'accounts');
  const authored = await session.execute({
    commandId: 'authored',
    command: 'continue',
    input: 'alice',
    parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 10 },
    resultId: 'alice-notes',
  });
  assert.equal(authored.ok, true);
  assert.equal(authored.result.handle.kind, 'events');
  assert.equal(authored.result.handle.count, 2);
  assert.equal(authored.result.completeness.status, 'complete');
  assert.equal(authored.result.completeness.scope, 'resident-corpus');

  const shownAuthored = await session.execute({
    commandId: 'show-authored',
    command: 'show',
    input: 'alice-notes',
    parameters: { previewLimit: 1 },
  });
  assert.deepEqual(
    {
      ok: shownAuthored.ok,
      type: shownAuthored.result.type,
      count: shownAuthored.result.count,
      previewTypes: shownAuthored.result.preview.map(({ type }) => type),
      omitted: shownAuthored.result.omitted,
    },
    {
      ok: true,
      type: 'result-collection',
      count: 2,
      previewTypes: ['event'],
      omitted: 1,
    },
  );

  const refined = await session.execute({
    commandId: 'refine-events',
    command: 'filter',
    input: 'alice-notes',
    parameters: { where: { field: 'subject.type', equals: 'event' } },
    resultId: 'refined-notes',
  });
  assert.equal(refined.ok, true);
  assert.equal(refined.result.handle.kind, 'events');
  const referencedAccounts = await session.execute({
    commandId: 'referenced-accounts',
    command: 'move',
    input: 'refined-notes',
    parameters: { to: 'referencedAccounts' },
    resultId: 'referenced-accounts',
  });
  assert.equal(referencedAccounts.ok, true);
  assert.equal(referencedAccounts.result.handle.kind, 'accounts');
  const hydratedReferencedAccounts = await session.execute({
    commandId: 'hydrate-referenced-accounts',
    command: 'hydrate',
    input: 'referenced-accounts',
    parameters: { relays: ['wss://fixture.invalid/'], timeoutMs: 50 },
    resultId: 'hydrated-referenced-accounts',
  });
  assert.equal(hydratedReferencedAccounts.ok, true);
  assert.equal(hydratedReferencedAccounts.result.handle.kind, 'events');

  const followed = await session.execute({
    commandId: 'followed-accounts',
    command: 'continue',
    input: 'alice',
    parameters: { relationship: 'followed-accounts', source: 'local' },
    resultId: 'alice-follows',
  });
  assert.equal(followed.ok, true);
  assert.equal(followed.result.handle.kind, 'accounts');
  const hydratedFollows = await session.execute({
    commandId: 'hydrate-follows',
    command: 'hydrate',
    input: 'alice-follows',
    parameters: { relays: ['wss://fixture.invalid/'], timeoutMs: 50 },
    resultId: 'hydrated-follows',
  });
  assert.equal(hydratedFollows.ok, true);
  assert.equal(hydratedFollows.result.handle.kind, 'events');

  await session.execute({
    commandId: 'seed-carol',
    command: 'select',
    parameters: { scope: 'corpus', ids: [carolProfile.id] },
    resultId: 'carol-profile',
  });
  await session.execute({
    commandId: 'carol-handle',
    command: 'move',
    input: 'carol-profile',
    parameters: { to: 'authors', limit: 1 },
    resultId: 'carol',
  });
  await session.execute({
    commandId: 'two-accounts',
    command: 'union',
    input: 'alice',
    parameters: { with: 'carol' },
    resultId: 'accounts',
  });
  const multiAuthored = await session.execute({
    commandId: 'multi-authored',
    command: 'continue',
    input: 'accounts',
    parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 10 },
    resultId: 'multi-notes',
  });
  assert.equal(multiAuthored.ok, true);
  assert.equal(multiAuthored.result.completeness.status, 'complete');
  assert.deepEqual(
    multiAuthored.result.completeness.inputs,
    {
      count: 2,
      resultCount: 2,
      statuses: [
        { value: 'empty-valid-result', count: 1 },
        { value: 'resolved', count: 1 },
      ],
    },
  );
  assert.deepEqual(multiAuthored.result.completeness.omissions, {
    count: 1,
    reasons: [{ value: 'empty-valid-result', count: 1 }],
  });

  const emptyFollows = await session.execute({
    commandId: 'empty-follows',
    command: 'continue',
    input: 'carol',
    parameters: { relationship: 'followed-accounts', source: 'local', eventLimit: 10 },
    resultId: 'carol-follows',
  });
  assert.equal(emptyFollows.ok, true);
  assert.equal(emptyFollows.result.handle.kind, 'accounts');
  assert.equal(emptyFollows.result.completeness.status, 'empty');
  assert.deepEqual(emptyFollows.result.completeness.inputs, {
    count: 1,
    resultCount: 0,
    statuses: [{ value: 'empty-valid-result', count: 1 }],
  });
  const hydratedEmptyFollows = await session.execute({
    commandId: 'hydrate-empty-follows',
    command: 'hydrate',
    input: 'carol-follows',
    parameters: { relays: ['wss://fixture.invalid/'] },
    resultId: 'hydrated-empty-follows',
  });
  assert.equal(hydratedEmptyFollows.ok, true);
  assert.equal(hydratedEmptyFollows.result.handle.kind, 'events');

  await session.execute({
    commandId: 'seed-dave-note',
    command: 'select',
    parameters: { scope: 'corpus', ids: [daveNote.id] },
    resultId: 'dave-note',
  });
  await session.execute({
    commandId: 'dave-handle',
    command: 'move',
    input: 'dave-note',
    parameters: { to: 'authors', limit: 1 },
    resultId: 'dave',
  });
  await session.execute({
    commandId: 'bounded-accounts',
    command: 'union',
    input: 'alice',
    parameters: { with: 'dave' },
    resultId: 'bounded-accounts',
  });
  const boundedMulti = await session.execute({
    commandId: 'bounded-multi',
    command: 'continue',
    input: 'bounded-accounts',
    parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 2 },
    resultId: 'bounded-notes',
  });
  assert.equal(boundedMulti.ok, true);
  assert.equal(boundedMulti.result.handle.count, 2);
  assert.equal(boundedMulti.result.completeness.status, 'partial');
  assert.deepEqual(boundedMulti.result.completeness.inputs, {
    count: 2,
    resultCount: 2,
    statuses: [
      { value: 'event-limit', count: 1 },
      { value: 'resolved', count: 1 },
    ],
  });
  assert.deepEqual(boundedMulti.result.completeness.omissions, {
    count: 1,
    reasons: [{ value: 'event-limit', count: 1 }],
  });

  const whyRoot = await session.execute({
    commandId: 'why-root',
    command: 'explain',
    input: 'multi-notes',
    parameters: { subject: { type: 'event', id: root.id } },
  });
  const continuationReasons = whyRoot.result.reasons.filter(
    ({ type }) => type === 'continuation',
  );
  assert.deepEqual(continuationReasons.map(({ start }) => start), [
    { type: 'account', id: alice },
  ]);

  const expanded = await session.execute({
    commandId: 'expand-account',
    command: 'continue',
    input: 'alice',
    parameters: { relationship: 'expansion', source: 'local', depth: 1, eventLimit: 1 },
    resultId: 'alice-expansion',
  });
  assert.equal(expanded.ok, true);
  assert.equal(expanded.result.handle.count, 1);
  assert.equal(expanded.result.completeness.status, 'partial');
  assert.equal(expanded.result.completeness.exhaustive, false);
  assert.deepEqual(expanded.result.completeness.boundsReached, ['event-limit']);

  const conversation = await session.execute({
    commandId: 'conversation',
    command: 'continue',
    input: 'root',
    parameters: {
      relationship: 'conversation', source: 'local', depth: 2, eventLimit: 10,
    },
    resultId: 'thread',
  });
  assert.equal(conversation.ok, true);
  assert.equal(conversation.result.handle.count, 2);
  assert.equal(conversation.result.handle.kind, 'events');

  const authoredNavigationPlan = [
    {
      id: 'root', operation: 'select',
      parameters: { scope: 'corpus', ids: [root.id] },
    },
    { id: 'account', operation: 'move', input: 'root', parameters: { to: 'authors' } },
    {
      id: 'authored', operation: 'continue', input: 'account',
      parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 10 },
    },
    {
      id: 'events', operation: 'filter', input: 'authored',
      parameters: { where: { field: 'subject.type', equals: 'event' } },
    },
    {
      id: 'accounts', operation: 'move', input: 'events',
      parameters: { to: 'referencedAccounts' },
    },
    {
      id: 'hydrated', operation: 'hydrate', input: 'accounts',
      parameters: { relays: ['wss://fixture.invalid/'], timeoutMs: 50 },
    },
  ];
  const planned = await executeResearchPlan(memory, authoredNavigationPlan);
  assert.deepEqual(
    planned.stages.map(({ result }) => result.collection?.kind ?? result.kind),
    ['events', 'accounts', 'events', 'events', 'accounts', 'events'],
  );
  assert.deepEqual(
    planned.stages.map(({ resultKind }) => resultKind),
    ['events', 'accounts', 'continuation-report', 'events', 'accounts', 'hydration-report'],
  );

  const genericRefinementPlan = [
    {
      id: 'notes', operation: 'select',
      parameters: { scope: 'corpus', authors: [alice], kinds: [1] },
    },
    {
      id: 'generic', operation: 'continue', input: 'notes',
      parameters: { relationship: 'expansion', source: 'local', depth: 1 },
    },
    {
      id: 'events', operation: 'filter', input: 'generic',
      parameters: { where: { field: 'subject.type', equals: 'event' } },
    },
  ];
  const refinedPlan = await executeResearchPlan(memory, genericRefinementPlan);
  assert.deepEqual(
    refinedPlan.stages.map(({ result }) => result.collection?.kind ?? result.kind),
    ['events', 'subjects', 'events'],
  );
  const followedNavigationPlan = [
    {
      id: 'profile', operation: 'select',
      parameters: { scope: 'corpus', ids: [carolProfile.id] },
    },
    { id: 'account', operation: 'move', input: 'profile', parameters: { to: 'authors' } },
    {
      id: 'follows', operation: 'continue', input: 'account',
      parameters: { relationship: 'followed-accounts', source: 'local' },
    },
    {
      id: 'hydrated', operation: 'hydrate', input: 'follows',
      parameters: { relays: ['wss://fixture.invalid/'] },
    },
  ];
  const followedPlan = await executeResearchPlan(memory, followedNavigationPlan);
  assert.deepEqual(
    followedPlan.stages.map(({ resultKind }) => resultKind),
    ['events', 'accounts', 'continuation-report', 'hydration-report'],
  );

  const schema = await session.execute({
    commandId: 'typed-schema', command: 'schema', parameters: {},
  });
  assert.equal(schema.ok, true);
  assert.deepEqual(schema.result.research.continuations['followed-accounts'], {
    inputKinds: ['accounts'], outputKind: 'accounts', sources: ['local', 'relays'],
  });
  assert.equal(
    schema.result.research.continuations['authored-notes'].outputKind,
    'events',
  );

  const explained = await session.execute({
    commandId: 'why-reply',
    command: 'explain',
    input: 'thread',
    parameters: { subject: { type: 'event', id: reply.id }, includeEvidence: true },
  });
  assert.equal(explained.ok, true);
  assert.equal(explained.result.member, true);
  assert.ok(explained.result.reasons.some(({ type, relationship }) => (
    type === 'continuation' && relationship === 'conversation'
  )));
  assert.ok(explained.result.reasons.some(({ relationshipType }) => (
    relationshipType === 'reply-parent'
  )));

  await session.close();

  const ceilingMemory = createInMemoryResearchMemory({ capacity: 1000 });
  const ceilingSession = createDeclarativeResearchSession(ceilingMemory);
  let seed;
  for (let index = 0; index < 1000; index += 1) {
    const event = sign(1, 1_000 + index, [], `ceiling note ${index}`, ALICE_SECRET);
    ceilingMemory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-26T12:00:00.000Z',
    });
    seed ??= event;
  }
  await ceilingSession.execute({
    commandId: 'ceiling-seed',
    command: 'select',
    parameters: { scope: 'corpus', ids: [seed.id] },
    resultId: 'ceiling-note',
  });
  await ceilingSession.execute({
    commandId: 'ceiling-author',
    command: 'move',
    input: 'ceiling-note',
    parameters: { to: 'authors', limit: 1 },
    resultId: 'ceiling-account',
  });
  const atProjectionCeiling = await ceilingSession.execute({
    commandId: 'ceiling-authored',
    command: 'continue',
    input: 'ceiling-account',
    parameters: {
      relationship: 'authored-notes', source: 'local', eventLimit: 1000,
    },
    resultId: 'ceiling-notes',
  });
  assert.equal(atProjectionCeiling.ok, true);
  assert.equal(atProjectionCeiling.result.handle.count, 1000);
  assert.equal(atProjectionCeiling.result.completeness.status, 'partial');
  assert.equal(atProjectionCeiling.result.completeness.exhaustive, false);
  assert.deepEqual(
    atProjectionCeiling.result.completeness.boundsReached,
    ['event-limit'],
  );
  await ceilingSession.close();
});

function sign(kind, createdAt, tags, content, secret) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, secret);
}
