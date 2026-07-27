import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('4'.repeat(64), 'hex'));

function note(createdAt, content, tags = [['t', 'field']]) {
  return finalizeEvent({ kind: 1, created_at: createdAt, tags, content }, SECRET);
}

function observation(index) {
  return {
    relay: `wss://relay-${index}.example/`,
    observedAt: `2026-07-27T12:00:0${index}.000Z`,
  };
}

test('relation handles resolve references across evidence lifetime and keep bounded views composable', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 2, archiveCapacity: 2 });
  const session = createDeclarativeResearchSession(memory);
  const oversizedTag = ['t', `nested-${'v'.repeat(4000)}`];
  const archived = note(1, `archive marker ${'a'.repeat(4000)}`, [oversizedTag]);
  const transient = note(2, `transient marker ${'b'.repeat(4000)}`);
  memory.ingest(archived, observation(1));
  memory.ingest(transient, observation(2));

  await session.execute({
    commandId: 'select', command: 'select',
    parameters: { scope: 'corpus', kinds: [1], order: 'oldest' }, resultId: 'notes',
  });
  await session.execute({
    commandId: 'relate', command: 'relate', input: 'notes',
    parameters: {}, resultId: 'rows',
  });
  await session.execute({
    commandId: 'scan', command: 'scan', input: 'rows',
    parameters: { fields: ['event.text'], terms: ['marker'], limit: 10 },
    resultId: 'matches',
  });
  await session.execute({
    commandId: 'join', command: 'join',
    inputs: { left: 'rows', right: 'rows' },
    parameters: {
      on: { left: 'subject.id', right: 'subject.id' },
      select: [{ field: 'event.text', name: 'joinedText' }],
      limit: 10,
    },
    resultId: 'joined',
  });
  await session.execute({
    commandId: 'aggregate', command: 'aggregate', input: 'rows',
    parameters: {
      by: [
        { field: 'event.text', name: 'groupText' },
        { field: 'event.tags', name: 'groupTags' },
      ],
      aggregations: [
        { name: 'samples', operation: 'sample', field: 'event.text', limit: 1 },
        { name: 'minimumTags', operation: 'min', field: 'event.tags' },
        { name: 'maximumTags', operation: 'max', field: 'event.tags' },
        { name: 'maximumText', operation: 'max', field: 'event.text' },
      ],
      limit: 2,
    },
    resultId: 'aggregate',
  });

  const resident = await session.execute({
    commandId: 'resident', command: 'show', input: 'joined',
    parameters: { previewLimit: 2, excerptLimit: 80 },
  });
  assert.equal(resident.ok, true);
  assert.deepEqual(
    resident.result.preview.map(({ values }) => values['evidence.resolutionSource']),
    ['buffer', 'buffer'],
  );
  assert.ok(resident.result.preview.every(({ values }) => values.joinedText.length <= 80));
  const aggregate = await session.execute({
    commandId: 'show-aggregate', command: 'show', input: 'aggregate',
    parameters: { previewLimit: 2, excerptLimit: 1000 },
  });
  assert.equal(aggregate.result.preview[0].values.samples.values.length, 1);
  assert.equal(aggregate.result.preview[0].values.samples.truncation.truncated, true);
  assert.equal(aggregate.result.preview[0].values.samples.truncation.inputCount, 1);
  assert.ok(aggregate.result.preview.every(({ values }) => values.groupText.length <= 280));
  assert.ok(aggregate.result.preview.every(({ values }) => values.maximumText.length <= 280));
  assert.ok(aggregate.result.preview.every(({ values }) => (
    values['groupText.truncation'].truncated === true
    && values['maximumText.truncation'].truncated === true
  )));
  assert.equal(aggregate.result.preview[0].values['groupTags.truncation'].truncated, true);
  assert.equal(aggregate.result.preview[0].values['minimumTags.truncation'].truncated, true);
  assert.equal(aggregate.result.preview[0].values['maximumTags.truncation'].truncated, true);
  assert.ok(aggregate.result.preview[0].values.minimumTags[0][1].length <= 280);
  assert.ok(aggregate.result.preview[0].values.maximumTags[0][1].length <= 280);

  memory.preserve(memory.lookup({ type: 'event', id: archived.id }), {
    level: 'canonical', reason: { type: 'field-trial-reference' },
  });
  memory.ingest(note(3, 'turnover one'), observation(3));
  memory.ingest(note(4, 'turnover two'), observation(4));

  const changed = await session.execute({
    commandId: 'changed', command: 'show', input: 'joined',
    parameters: { previewLimit: 2, excerptLimit: 80 },
  });
  assert.deepEqual(
    changed.result.preview.map(({ values }) => values['evidence.resolutionSource']),
    ['archive', 'unresolved'],
  );
  assert.match(changed.result.preview[0].values.joinedText, /archive marker/);
  assert.equal(changed.result.preview[1].values.joinedText, null);

  const aggregateAfterTurnover = await session.execute({
    commandId: 'aggregate-after-turnover', command: 'show', input: 'aggregate',
    parameters: { previewLimit: 2, excerptLimit: 1000 },
  });
  assert.deepEqual(aggregateAfterTurnover.result.preview, aggregate.result.preview);

  const scanned = await session.execute({
    commandId: 'scanned', command: 'show', input: 'matches',
    parameters: { previewLimit: 2, excerptLimit: 200 },
  });
  assert.ok(scanned.result.preview.every(({ values }) => (
    values['match.excerpt'].length < 400
    && Number.isInteger(values['match.start'])
    && values['match.sourceSubject']?.type === 'event'
  )));
  assert.ok(scanned.result.preview.every(({ values }) => !('match.value' in values)));

  const firstWindow = await session.execute({
    commandId: 'window-one', command: 'show', input: 'matches',
    parameters: { offset: 0, previewLimit: 1, sizeLimit: 1000 },
  });
  const secondWindow = await session.execute({
    commandId: 'window-two', command: 'show', input: 'matches',
    parameters: {
      offset: firstWindow.result.nextOffset,
      previewLimit: 1,
      sizeLimit: 1000,
    },
  });
  assert.equal(firstWindow.result.offset, 0);
  assert.equal(firstWindow.result.limit, 1);
  assert.equal(firstWindow.result.omittedBefore, 0);
  assert.equal(firstWindow.result.omittedAfter, 1);
  assert.equal(secondWindow.result.offset, 1);
  assert.equal(secondWindow.result.omittedBefore, 1);
  assert.equal(secondWindow.result.omittedAfter, 0);

  await session.close();
});
