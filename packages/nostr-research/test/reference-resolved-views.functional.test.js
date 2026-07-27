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
  const session = createDeclarativeResearchSession(memory, {
    relays: ['wss://relay.example'],
  });
  const oversizedTag = ['t', `nested-${'v'.repeat(4000)}`];
  const archived = note(1, `archive marker ${'a'.repeat(4000)}`, [oversizedTag]);
  const transient = note(
    2,
    `partial transient marker https://nostr.build/media-object ${'b'.repeat(4000)}`,
  );
  memory.ingest(archived, observation(1));
  memory.ingest(transient, observation(2));

  await session.execute({
    commandId: 'select', command: 'select',
    parameters: { scope: 'corpus', kinds: [1], order: 'oldest' }, resultId: 'notes',
  });
  await session.execute({
    commandId: 'relate', command: 'relate', input: 'notes',
    resultId: 'rows',
  });
  await session.execute({
    commandId: 'scan', command: 'scan', input: 'rows',
    parameters: { fields: ['event.text'], terms: ['marker'], limit: 10 },
    resultId: 'matches',
  });
  await session.execute({
    commandId: 'media', command: 'filter', input: 'rows',
    parameters: { where: { field: 'event.hasMedia', equals: true } },
    resultId: 'media',
  });
  await session.execute({
    commandId: 'substring-scan', command: 'scan', input: 'rows',
    parameters: {
      fields: ['event.text'], terms: ['art'], matchMode: 'substring', limit: 10,
    },
    resultId: 'substring-matches',
  });
  await session.execute({
    commandId: 'word-scan', command: 'scan', input: 'rows',
    parameters: {
      fields: ['event.text'], terms: ['art'], matchMode: 'word', limit: 10,
    },
    resultId: 'word-matches',
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
  const rows = await session.execute({
    commandId: 'show-rows', command: 'show', input: 'rows',
    parameters: { previewLimit: 2 },
  });
  assert.equal(rows.result.count, 2);
  assert.equal(rows.result.distinctSubjectCount, 2);
  assert.equal(rows.result.distinctAuthorCount, 1);
  const rowSchema = await session.execute({
    commandId: 'schema-rows', command: 'schema', input: 'rows', parameters: {},
  });
  assert.equal(rowSchema.result.type, 'handle-schema');
  assert.equal(rowSchema.result.handle.kind, 'relation');
  assert.equal('preview' in rowSchema.result, false);
  assert.deepEqual(
    rowSchema.result.structure.fields.find(({ name }) => name === 'event.text'),
    { name: 'event.text', rowsWithValue: 2, nullRows: 0, types: ['string'] },
  );
  assert.deepEqual(
    rowSchema.result.structure.fields.find(({ name }) => name === 'account.description'),
    { name: 'account.description', rowsWithValue: 0, nullRows: 2, types: [] },
  );
  assert.equal(rowSchema.result.compatibleOperations.includes('scan'), true);
  assert.equal(rowSchema.result.compatibleOperations.includes('extract'), true);
  assert.equal(rowSchema.result.compatibleOperations.includes('fetch'), true);
  assert.deepEqual(
    [...rowSchema.result.compatibleOperations].sort(),
    [
      'aggregate', 'balance', 'derive', 'distinct', 'explode', 'extract',
      'fetch', 'filter', 'join', 'project', 'scan', 'slice', 'sort',
    ].sort(),
  );
  assert.equal('operations' in rowSchema.result, false);

  const scanSchema = await session.execute({
    commandId: 'schema-scan', command: 'schema', input: 'rows',
    parameters: { operation: 'scan' },
  });
  assert.equal(scanSchema.result.type, 'handle-operation-schema');
  assert.equal(scanSchema.result.operation.name, 'scan');
  assert.equal(
    scanSchema.result.operation.populatedFields.some(({ name }) => name === 'event.text'),
    true,
  );
  assert.equal(
    scanSchema.result.operation.populatedFields.some(
      ({ name }) => name === 'account.description',
    ),
    false,
  );
  assert.equal('operations' in scanSchema.result, false);
  assert.equal('compatibleOperations' in scanSchema.result, false);

  const relateSchema = await session.execute({
    commandId: 'schema-relate', command: 'schema', input: 'notes',
    parameters: { operation: 'relate' },
  });
  assert.deepEqual(relateSchema.result.operation.parameters, {});

  const extractSchema = await session.execute({
    commandId: 'schema-extract', command: 'schema', input: 'rows',
    parameters: { operation: 'extract' },
  });
  assert.deepEqual(extractSchema.result.operation.recognizedTransitions, [
    { field: 'subject.id', subjectType: 'event' },
    { field: 'event.author', subjectType: 'account' },
  ]);

  const fetchSchema = await session.execute({
    commandId: 'schema-fetch', command: 'schema', input: 'rows',
    parameters: { operation: 'fetch' },
  });
  assert.equal(fetchSchema.result.operation.locality, 'external');
  assert.deepEqual(fetchSchema.result.operation.effectiveDefaults.relays, [
    'wss://relay.example/',
  ]);
  assert.equal(
    fetchSchema.result.operation.remainingChoices.some((choice) => /relay URL/.test(choice)),
    false,
  );
  const absentField = await session.execute({
    commandId: 'absent-field', command: 'scan', input: 'rows',
    parameters: { fields: ['event.content'], terms: ['marker'] },
    resultId: 'absent-field-result',
  });
  assert.equal(absentField.ok, false);
  assert.equal(absentField.error.code, 'INVALID_OPERATION');
  assert.match(absentField.error.message, /event\.content/);
  assert.match(absentField.error.message, /event\.text/);
  const knownEmptyField = await session.execute({
    commandId: 'known-empty-field', command: 'scan', input: 'rows',
    parameters: { fields: ['account.description'], terms: ['artist'] },
    resultId: 'known-empty-field-result',
  });
  assert.equal(knownEmptyField.ok, true);
  assert.equal(knownEmptyField.result.handle.count, 0);
  const media = await session.execute({
    commandId: 'show-media', command: 'show', input: 'media',
    parameters: { previewLimit: 2 },
  });
  assert.equal(media.result.count, 1);
  assert.equal(media.result.preview[0].values['subject.id'], transient.id);
  const secondNote = await session.execute({
    commandId: 'second-note', command: 'show', input: 'notes',
    parameters: { offset: 1, previewLimit: 1, excerptLimit: 80 },
  });
  assert.equal(secondNote.result.preview[0].id, transient.id);
  assert.equal(secondNote.result.offset, 1);
  assert.equal(secondNote.result.nextOffset, 2);
  const boundedNote = await session.execute({
    commandId: 'bounded-note', command: 'show', input: 'notes',
    parameters: { previewLimit: 2, excerptLimit: 1000, sizeLimit: 1000 },
  });
  assert.equal(boundedNote.result.preview.length, 1);
  assert.equal(boundedNote.result.preview[0].id, archived.id);
  assert.equal(boundedNote.result.sizeBounded, true);
  assert.equal(boundedNote.result.requestedItems, 2);
  assert.equal(boundedNote.result.returnedItems, 1);
  assert.equal(boundedNote.result.boundReason, 'response-size');
  const substringMatches = await session.execute({
    commandId: 'show-substring-scan', command: 'show', input: 'substring-matches',
    parameters: { previewLimit: 10 },
  });
  const wordMatches = await session.execute({
    commandId: 'show-word-scan', command: 'show', input: 'word-matches',
    parameters: { previewLimit: 10 },
  });
  assert.equal(substringMatches.result.count, 1);
  assert.equal(wordMatches.result.count, 0);
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
  const notesAfterTurnover = await session.execute({
    commandId: 'notes-after-turnover', command: 'show', input: 'notes',
    parameters: { mode: 'coverage', previewLimit: 2 },
  });
  assert.deepEqual(notesAfterTurnover.result.coverage.evidenceResolution, {
    buffer: 0, archive: 1, unresolved: 1,
  });

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
