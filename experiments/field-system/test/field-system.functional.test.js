import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createFieldSystem } from '@nostrarium/field-system';

const NOTE = {
  kind: 1,
  created_at: 1,
  tags: [['t', 'music']],
  content: 'music note',
  pubkey: '4f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa',
  id: '7c5abb3f14b4faec030d9a3def9a5b65a8e86d85cb298c5e193b729854440070',
  sig: '863253b05f92859c0bb613d2ac9a90f4bf8b6b81936503c70b23e5ab539df88af2ccad52f2654b341a329fb586f2fc0f7cf3dbfad4a3f405e84fab1b4f50e9c5',
};

test('field actions remain visible and hand ordinary handles to other systems', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  memory.ingest(NOTE, { relay: 'wss://fixture.example/' });
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const field = createFieldSystem({ controller });

  await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'field',
  });

  const sampled = await field.sample({
    input: 'field',
    limit: 1,
    seed: 'boarding',
    resultId: 'entrances',
  });
  assert.deepEqual(sampled.command, {
    command: 'sample',
    input: 'field',
    parameters: { limit: 1, seed: 'boarding' },
    resultId: 'entrances',
  });
  assert.equal(sampled.receipt.handle.id, 'entrances');
  assert.equal(sampled.receipt.handle.count, 1);

  const observed = await field.observe({
    input: 'entrances',
    mode: 'summary',
  });
  assert.equal(observed.command.command, 'show');
  assert.equal(observed.panels.orientation.count, 1);
  assert.equal(observed.panels.orientation.countUnit, 'subjects');

  const transferred = await field.handoff('entrances');
  assert.deepEqual(transferred.command, {
    command: 'schema',
    input: 'entrances',
    parameters: {},
  });
  assert.equal(transferred.handoff.type, 'nostrarium-handle-handoff');
  assert.equal(transferred.handoff.from, 'field');
  assert.equal(transferred.handoff.handle.id, 'entrances');
  assert.equal(transferred.handoff.handle.kind, 'events');
  assert.equal(
    transferred.handoff.compatibleOperations.includes('move'),
    true,
  );

  const resampled = await field.sample({
    input: transferred.handoff,
    limit: 1,
    resultId: 'oneEntrance',
  });
  assert.equal(resampled.receipt.handle.count, 1);
  assert.deepEqual(
    controller.transcript().entries.slice(-4).map(({ command }) => command.command),
    ['sample', 'show', 'schema', 'sample'],
  );

  await controller.close();
});

test('field comparison is one explicit set command and does not hide a workflow', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  memory.ingest(NOTE, { relay: 'wss://fixture.example/' });
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 20, maxBytes: 100_000 },
  });
  const field = createFieldSystem({ controller });

  await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', ids: [NOTE.id] },
    resultId: 'all',
  });
  await field.sample({
    input: 'all', limit: 1, seed: 'left', resultId: 'left',
  });
  await field.sample({
    input: 'all', limit: 1, seed: 'right', resultId: 'right',
  });

  const compared = await field.compare('intersection', {
    input: 'left',
    with: 'right',
    limit: 10,
    resultId: 'shared',
  });
  assert.deepEqual(compared.command, {
    command: 'intersection',
    input: 'left',
    parameters: { limit: 10, with: 'right' },
    resultId: 'shared',
  });
  assert.equal(compared.response.ok, true);
  assert.equal(compared.receipt.handle.id, 'shared');

  assert.throws(
    () => field.compare('union', { input: 'left', with: 'right' }),
    /operation must be intersection, difference, or compare/,
  );
  await controller.close();
});
