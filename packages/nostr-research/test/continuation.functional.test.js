import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
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
  const root = sign(1, 100, [], 'root', ALICE_SECRET);
  const other = sign(1, 110, [], 'another authored note', ALICE_SECRET);
  const reply = sign(
    1, 120, [['e', root.id, '', 'reply']], 'reply', BOB_SECRET,
  );
  const daveNote = sign(1, 130, [], 'dave note', DAVE_SECRET);
  const carolProfile = sign(
    0, 90, [], JSON.stringify({ name: 'carol' }), CAROL_SECRET,
  );
  const carolEmptyFollowList = sign(3, 95, [], '', CAROL_SECRET);
  for (const event of [
    root, other, reply, daveNote, carolProfile, carolEmptyFollowList,
  ]) {
    memory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-26T12:00:00.000Z',
    });
  }

  await session.execute({
    commandId: 'seed-note',
    command: 'select',
    parameters: { scope: 'corpus', ids: [root.id] },
    resultId: 'root',
  });
  await session.execute({
    commandId: 'author-handle',
    command: 'move',
    input: 'root',
    parameters: { to: 'authors', limit: 1 },
    resultId: 'alice',
  });
  const authored = await session.execute({
    commandId: 'authored',
    command: 'continue',
    input: 'alice',
    parameters: { relationship: 'authored-notes', source: 'local', eventLimit: 10 },
    resultId: 'alice-notes',
  });
  assert.equal(authored.ok, true);
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
    multiAuthored.result.completeness.inputs.map(({ subject, status, resultCount }) => ({
      id: subject.id, status, resultCount,
    })),
    [
      { id: alice, status: 'resolved', resultCount: 2 },
      { id: carol, status: 'empty-valid-result', resultCount: 0 },
    ],
  );
  assert.deepEqual(multiAuthored.result.completeness.omissions, [{
    subject: { type: 'account', id: carol },
    reason: 'empty-valid-result',
  }]);

  const emptyFollows = await session.execute({
    commandId: 'empty-follows',
    command: 'continue',
    input: 'carol',
    parameters: { relationship: 'followed-accounts', source: 'local', eventLimit: 10 },
    resultId: 'carol-follows',
  });
  assert.equal(emptyFollows.ok, true);
  assert.equal(emptyFollows.result.completeness.status, 'empty');
  assert.deepEqual(emptyFollows.result.completeness.inputs, [{
    subject: { type: 'account', id: carol },
    status: 'empty-valid-result',
    resultCount: 0,
  }]);

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
  assert.deepEqual(
    boundedMulti.result.completeness.inputs.map(
      ({ subject, status, resultCount, omittedCount }) => ({
        id: subject.id, status, resultCount, omittedCount,
      }),
    ),
    [
      { id: alice, status: 'resolved', resultCount: 2, omittedCount: undefined },
      { id: daveNote.pubkey, status: 'event-limit', resultCount: 0, omittedCount: 1 },
    ],
  );
  assert.ok(boundedMulti.result.completeness.omissions.some((omission) => (
    omission.subject.id === daveNote.pubkey
      && omission.reason === 'event-limit'
      && omission.omittedCount === 1
  )));

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
