import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { arrangeControls, arrangeObservation } from '@nostrarium/controller/arrangement';
import { createNavigatorController } from '@nostrarium/controller';

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
