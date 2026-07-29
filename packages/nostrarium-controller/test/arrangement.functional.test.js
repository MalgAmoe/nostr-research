import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import {
  arrangeCommand,
  arrangeControls,
  arrangeObservation,
  composeCommand,
} from '@nostrarium/controller/arrangement';
import { createNavigatorController } from '@nostrarium/controller';

const NOTE = {
  kind: 1,
  created_at: 1,
  tags: [['t', 'music']],
  content: 'music note',
  pubkey: '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
  id: '7c5abb3f14b4faec030d9a3def9a5b65a8e86d85cb298c5e193b729854440070',
  sig: '863253b05f92859c0bb613d2ac9a90f4bf8b6b81936503c70b23e5ab539df88af2ccad52f2654b341a329fb586f2fc0f7cf3dbfad4a3f405e84fab1b4f50e9c5',
};

test('schema and show responses remain explicit while the arrangement makes them navigable', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 20, maxBytes: 100_000 },
  });

  await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'notes',
  });
  const broad = await controller.execute({
    command: 'schema', input: 'notes', parameters: {},
  });
  const move = await controller.execute({
    command: 'schema', input: 'notes', parameters: { operation: 'move' },
  });
  const shown = await controller.execute({
    command: 'show', input: 'notes', parameters: { mode: 'summary' },
  });

  const controls = arrangeControls(broad.response, [move.response]);
  assert.deepEqual(
    controls.groups.map(({ id }) => id),
    ['contact', 'movement', 'analysis', 'judgment', 'collection'],
  );
  const movement = controls.groups.find(({ id }) => id === 'movement');
  assert.deepEqual(
    movement.controls.map(({ name }) => name),
    ['pick', 'limit', 'sample', 'move', 'union', 'intersection', 'difference', 'compare'],
  );
  assert.equal(
    movement.controls.find(({ name }) => name === 'move').contractLoaded,
    true,
  );
  assert.equal(
    movement.controls.find(({ name }) => name === 'sample').contractLoaded,
    false,
  );

  const observation = arrangeObservation(shown.response);
  assert.equal(observation.orientation.observation, 'summary');
  assert.equal(observation.orientation.count, 0);
  assert.equal(observation.orientation.countUnit, 'subjects');
  assert.deepEqual(observation.evidence.evidenceResolution, {
    buffer: 0, archive: 0, unresolved: 0,
  });
  assert.equal(observation.paging.sizeBounded, false);

  await controller.execute({
    command: 'relate', input: 'notes', parameters: {}, resultId: 'rows',
  });
  const relationSchema = await controller.execute({
    command: 'schema', input: 'rows', parameters: {},
  });
  const relationControls = arrangeControls(relationSchema.response);
  assert.equal(relationControls.groups.some(({ id }) => id === 'other'), false);
  assert.deepEqual(
    relationControls.groups.find(({ id }) => id === 'analysis').controls
      .map(({ name }) => name),
    [
      'filter', 'project', 'distinct', 'sort', 'join', 'aggregate',
      'derive', 'slice', 'explode', 'scan', 'balance',
    ],
  );

  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'schema', 'schema', 'show', 'relate', 'schema'],
  );
  await controller.close();
});

test('focused contracts compose visible commands without repeating observed construction failures', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  memory.ingest(NOTE, { relay: 'wss://fixture.example/' });
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });

  await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'notes',
  });
  await controller.execute({
    command: 'relate', input: 'notes', parameters: {}, resultId: 'rows',
  });
  const focused = async (input, operation) => (await controller.execute({
    command: 'schema', input, parameters: { operation },
  })).response;

  const preserve = arrangeCommand(await focused('notes', 'preserve'));
  assert.deepEqual(
    preserve.parameters.filter(({ required }) => required).map(({ name }) => name),
    ['level', 'reason'],
  );
  assert.throws(
    () => composeCommand(preserve, {
      parameters: { level: 'excerpt', reason: { note: 'evidence' } },
    }),
    /reason must be an object with a non-empty type/,
  );
  const preserveDraft = composeCommand(preserve, {
    parameters: { level: 'excerpt', reason: { type: 'evidence' } },
  });
  assert.deepEqual(preserveDraft, {
    command: 'preserve',
    input: 'notes',
    parameters: { level: 'excerpt', reason: { type: 'evidence' } },
  });
  assert.equal((await controller.execute(preserveDraft)).response.ok, true);

  const remember = arrangeCommand(await focused('notes', 'remember'));
  assert.equal(remember.parameters.some(({ name }) => name === 'content'), false);
  assert.throws(
    () => composeCommand(remember, {
      parameters: { reason: 'reviewed', attribution: 'navigator' },
    }),
    /At least one parameter is required/,
  );
  const rememberDraft = composeCommand(remember, {
    parameters: {
      judgment: 'interested', reason: 'reviewed', attribution: 'navigator',
    },
  });
  assert.equal(rememberDraft.parameters.judgment, 'interested');
  assert.equal((await controller.execute(rememberDraft)).response.ok, true);

  const aggregate = arrangeCommand(await focused('rows', 'aggregate'));
  assert.throws(
    () => composeCommand(aggregate, {
      parameters: { aggregations: [{ as: 'noteCount', op: 'count' }] },
    }),
    /missing required field/,
  );
  const aggregateDraft = composeCommand(aggregate, {
    parameters: {
      by: [{ field: 'event.author', name: 'account' }],
      aggregations: [{ name: 'noteCount', operation: 'count' }],
    },
    resultId: 'counts',
  });
  assert.equal(aggregateDraft.command, 'aggregate');
  assert.equal(aggregateDraft.input, 'rows');
  assert.deepEqual(aggregateDraft.parameters.aggregations, [
    { name: 'noteCount', operation: 'count' },
  ]);
  assert.equal((await controller.execute(aggregateDraft)).response.ok, true);

  const continuation = arrangeCommand(await focused('notes', 'continue'));
  assert.throws(
    () => composeCommand(continuation, {
      parameters: { relationship: 'authored-events', source: 'relays' },
    }),
    /relationship must use a value exposed by its focused contract/,
  );
  const continuationDraft = composeCommand(continuation, {
    parameters: { relationship: 'replies', source: 'local' },
    resultId: 'replies',
  });
  assert.equal(continuationDraft.parameters.relationship, 'replies');
  assert.equal((await controller.execute(continuationDraft)).response.ok, true);

  const scan = arrangeCommand(await focused('rows', 'scan'));
  assert.equal(
    scan.parameters.find(({ name }) => name === 'fields').choices.includes('event.text'),
    true,
  );
  assert.throws(
    () => composeCommand(scan, {
      parameters: { fields: ['event.content'], terms: ['music'] },
    }),
    /fields must use a value exposed by its focused contract/,
  );
  const scanDraft = composeCommand(scan, {
    parameters: { fields: ['event.text'], terms: ['music'] },
    resultId: 'matches',
  });
  const scanned = await controller.execute(scanDraft);
  assert.equal(scanned.response.ok, true);
  assert.equal(scanned.response.result.handle.count, 1);

  const globalSchema = await controller.execute({ command: 'schema', parameters: {} });
  assert.throws(
    () => arrangeCommand(globalSchema.response),
    /focused operation contract/,
  );

  await controller.close();
});
