import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createFieldWorkbench } from '@nostrarium/field-system/workbench';

const NOTE = {
  kind: 1,
  created_at: 1,
  tags: [['t', 'music']],
  content: 'music note',
  pubkey: '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
  id: '7c5abb3f14b4faec030d9a3def9a5b65a8e86d85cb298c5e193b729854440070',
  sig: '863253b05f92859c0bb613d2ac9a90f4bf8b6b81936503c70b23e5ab539df88af2ccad52f2654b341a329fb586f2fc0f7cf3dbfad4a3f405e84fab1b4f50e9c5',
};

test('workbench reshapes one field through visible contextual commands', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  memory.ingest(NOTE, { relay: 'wss://fixture.example/' });
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const workbench = createFieldWorkbench({ controller });

  await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'notes',
  });

  const opened = await workbench.open('notes');
  assert.equal(opened.field.current.id, 'notes');

  const relate = await workbench.prepare('relate');
  const rows = await workbench.execute(relate.composition, {
    parameters: {},
    resultId: 'rows',
  }, { adopt: true });
  assert.equal(rows.field.current.id, 'rows');
  assert.deepEqual(rows.command, {
    command: 'relate',
    input: 'notes',
    parameters: {},
    resultId: 'rows',
  });

  const scan = await workbench.prepare('scan');
  const matches = await workbench.execute(scan.composition, {
    parameters: { fields: ['event.text'], terms: ['music'] },
    resultId: 'matches',
  }, { adopt: true });
  assert.equal(matches.field.current.id, 'matches');
  assert.equal(matches.receipt.handle.count, 1);

  const returned = workbench.returnTo('notes');
  assert.equal(returned.current.id, 'notes');
  assert.deepEqual(
    returned.known.map(({ id }) => id),
    ['notes', 'rows', 'matches'],
  );

  const observation = await workbench.observe({ mode: 'summary' });
  assert.equal(observation.panels.orientation.count, 1);
  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'schema', 'schema', 'relate', 'schema', 'scan', 'show'],
  );

  await controller.close();
});

test('results remain alternatives until the navigator explicitly adopts one', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 20, maxBytes: 100_000 },
  });
  const workbench = createFieldWorkbench({ controller });

  const selected = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'field',
  });
  workbench.adopt(selected, 'initial field');

  const sample = await workbench.prepare('sample');
  const entrances = await workbench.execute(sample.composition, {
    parameters: { limit: 1, seed: 'entrances' },
    resultId: 'entrances',
  });

  assert.equal(entrances.receipt.handle.id, 'entrances');
  assert.equal(entrances.field.current.id, 'field');
  assert.deepEqual(
    entrances.field.known.map(({ id }) => id),
    ['field', 'entrances'],
  );

  workbench.adopt(entrances, 'navigator chose entrances');
  assert.equal(workbench.state().current.id, 'entrances');

  await controller.close();
});
