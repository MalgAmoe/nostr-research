import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  acquireRelayEvents,
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  executeResearchOperation,
  subject,
} from '@nostr-research/memory';

const ALICE_KEY = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('2'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_KEY);
const bob = getPublicKey(BOB_KEY);

test('address subjects navigate typed references to current local replaceable evidence', async () => {
  const articleAddress = `30023:${alice}:research:nostr`;
  const profileAddress = `0:${alice}:`;
  const missingAddress = `30023:${bob}:missing`;
  const oldArticle = sign(30023, 100, [['d', 'research:nostr']], 'old', ALICE_KEY);
  const tiedA = sign(30023, 200, [['d', 'research:nostr']], 'tie a', ALICE_KEY);
  const tiedB = sign(30023, 200, [['d', 'research:nostr']], 'tie b', ALICE_KEY);
  const currentArticle = [tiedA, tiedB].sort((left, right) => left.id.localeCompare(right.id))[0];
  const source = sign(1, 300, [
    ['a', articleAddress, 'wss://hint.example'],
    ['a', missingAddress],
    ['a', `1:${alice}:not-replaceable`],
  ], 'address references', BOB_KEY);
  const comment = sign(1111, 400, [
    ['A', articleAddress, 'wss://root-hint.example'],
    ['a', missingAddress, 'wss://parent-hint.example'],
  ], 'address comment', BOB_KEY);
  const memory = createInMemoryResearchMemory({ capacity: 10, archiveCapacity: 10 });
  try {
    assert.deepEqual(subject('address', articleAddress), {
      type: 'address', id: articleAddress,
    });
    assert.deepEqual(subject('address', profileAddress), {
      type: 'address', id: profileAddress,
    });
    for (const invalid of [
      `0:${alice}`, `0:${alice}:named`, `1:${alice}:`,
      `30023:${alice.toUpperCase()}:research`, `030023:${alice}:research`,
    ]) assert.throws(() => subject('address', invalid), /canonical replaceable coordinate/);

    for (const event of [oldArticle, tiedB, tiedA, source, comment]) ingest(memory, event);
    assert.equal(memory.inspect(subject('address', articleAddress)).evidence.event.id,
      currentArticle.id);
    assert.equal(memory.getEvent(oldArticle.id).event.content, 'old');

    const sourceCollection = memory.lookup(subject('event', source.id));
    const addresses = memory.transform(sourceCollection, {
      operation: 'move', to: 'referencedAddresses', limit: 10,
    });
    assert.equal(addresses.kind, 'addresses');
    assert.deepEqual(addresses.items.map(({ subject: item }) => item.id),
      [articleAddress, missingAddress].sort());
    const boundedAddresses = memory.transform(sourceCollection, {
      operation: 'move', to: 'referencedAddresses', limit: 1,
    });
    assert.deepEqual(boundedAddresses.context.cardinality, {
      inputCount: 1,
      discoveredCount: 2,
      outputCount: 1,
      omittedCount: 1,
      truncated: true,
    });
    const noAddresses = memory.transform(memory.lookup(subject('event', currentArticle.id)), {
      operation: 'move', to: 'referencedAddresses', limit: 10,
    });
    assert.deepEqual(noAddresses.context.cardinality, {
      inputCount: 1,
      discoveredCount: 0,
      outputCount: 0,
      omittedCount: 0,
      truncated: false,
    });
    assert.ok(addresses.items.every(({ reasons, provenance }) => (
      reasons.some(({ relationshipType }) => relationshipType === 'referenced-address')
      && reasons.some(({ type }) => type === 'collection-move')
      && provenance.some(({ relay }) => relay === 'wss://evidence.example')
    )));
    const resolved = memory.transform(addresses, {
      operation: 'move', to: 'currentEvents', limit: 10,
    });
    assert.deepEqual(resolved.items.map(({ subject: item }) => item.id), [currentArticle.id]);
    assert.ok(resolved.items[0].reasons.some(
      ({ transition }) => transition === 'address-current-event',
    ));
    assert.equal(memory.inspect(subject('address', missingAddress)).resolved, false);

    const commentRelationships = memory.inspect(subject('event', comment.id)).relationships;
    assert.ok(commentRelationships.some(({ type, target }) => (
      type === 'comment-root-address' && target.id === articleAddress
    )));
    assert.ok(commentRelationships.some(({ type, target }) => (
      type === 'comment-parent-address' && target.id === missingAddress
    )));
    assert.ok(!commentRelationships.some(({ type }) => (
      ['reply-root', 'reply-parent'].includes(type)
    )));
    assert.ok(!memory.inspect(subject('event', source.id)).relationships.some(
      ({ target }) => target.id === `1:${alice}:not-replaceable`
        && target.type === 'address',
    ));

    const relation = await executeResearchOperation(memory, {
      operation: 'relate', parameters: {},
    }, addresses);
    const extracted = await executeResearchOperation(memory, {
      operation: 'extract',
      parameters: { field: 'subject.id', subjectType: 'address', limit: 10 },
    }, relation);
    assert.equal(extracted.kind, 'addresses');
    assert.deepEqual(extracted.items.map(({ subject: item }) => item.id),
      [articleAddress, missingAddress].sort());

    const membership = memory.rememberMembership(addresses, 'address leads', {
      reason: { type: 'lead-set' }, attribution: 'test',
    });
    assert.equal(memory.listMemberships().find(
      ({ name }) => name === membership.name,
    ).counts.address, 2);
    assert.equal(memory.asCollection(membership).kind, 'addresses');

    memory.preserve(memory.lookup(subject('address', articleAddress)), {
      level: 'canonical', reason: { type: 'stable-reference' },
    });
    for (let index = 0; index < 10; index += 1) {
      ingest(memory, sign(1, 500 + index, [], `turnover ${index}`, BOB_KEY));
    }
    assert.equal(memory.inspect(subject('address', articleAddress)).resolutionSource, 'archive');
    memory.releaseEvidence([subject('address', articleAddress)]);
    assert.equal(memory.inspect(subject('address', articleAddress)).resolutionSource, 'unresolved');

    memory.remember(subject('address', articleAddress), {
      labels: ['address-schema'],
      reason: 'retain stable address identity',
      attribution: 'test',
    });
    const session = createDeclarativeResearchSession(memory);
    const installed = await session.execute({
      commandId: 'addresses', command: 'notebook',
      resultId: 'addresses',
      parameters: { labels: ['address-schema'], limit: 10 },
    });
    assert.equal(installed.ok, true);
    const filtered = await session.execute({
      commandId: 'filter-addresses', command: 'filter', input: 'addresses',
      resultId: 'typed-addresses',
      parameters: {
        where: { field: 'subject.type', equals: 'address' },
        limit: 10,
      },
    });
    assert.equal(filtered.ok, true);
    const schema = await session.execute({
      commandId: 'address-schema', command: 'schema',
      input: 'typed-addresses', parameters: {},
    });
    assert.equal(schema.ok, true);
    assert.ok(schema.result.compatibleOperations.includes('move'));
    const moveSchema = await session.execute({
      commandId: 'address-move-schema', command: 'schema',
      input: 'typed-addresses', parameters: { operation: 'move' },
    });
    assert.ok(moveSchema.result.operation.choices.to.some(
      ({ to }) => to === 'currentEvents',
    ));
    await session.close();
  } finally {
    memory.close();
  }
});

test('ordinary acquisition accepts an explicit canonical #a filter', async () => {
  const coordinate = `30023:${alice}:research:nostr`;
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const controller = new AbortController();
  controller.abort();
  try {
    const report = await acquireRelayEvents(memory, {
      relays: ['wss://fixture.invalid/'],
      filter: { '#a': [coordinate] },
      signal: controller.signal,
    });
    assert.deepEqual(report.requested.filter, { '#a': [coordinate] });
    assert.equal(report.completionReason, 'cancelled');
  } finally {
    memory.close();
  }
});

function sign(kind, createdAt, tags, content, key) {
  return finalizeEvent({ kind, created_at: createdAt, tags, content }, key);
}

function ingest(memory, event) {
  memory.ingest(event, {
    relay: 'wss://evidence.example',
    observedAt: '2026-07-28T10:00:00.000Z',
  });
}
