import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import {
  createFlightConsole,
  FlightCommandError,
} from '@nostrarium/flight-console';

function fixture() {
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  const first = Uint8Array.from({ length: 32 }, () => 1);
  const second = Uint8Array.from({ length: 32 }, () => 2);
  const observed = { relay: 'wss://fixture.invalid/' };
  memory.ingest(event(first, 1, 'one'), observed);
  memory.ingest(event(first, 2, 'two', [['p', getPublicKey(second)]]), observed);
  memory.ingest(event(second, 3, 'three'), observed);
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 100, maxBytes: 300_000 },
  });
  return {
    controller,
    console: createFlightConsole({ controller, namePrefix: 'test' }),
  };
}

test('flight execution names handles, accepts handles as inputs, and fails immediately', async () => {
  const { controller, console } = fixture();
  const field = await console.exec('select', {
    scope: 'corpus',
    kinds: [1],
    as: 'field',
    placement: 'home',
  });
  const rows = await console.exec('relate', {
    input: field,
    as: 'rows',
    placement: 'current',
  });

  assert.equal(field.handle.id, 'field');
  assert.equal(rows.handle.id, 'rows');
  assert.equal(console.state().navigation.home.id, 'field');
  assert.equal(console.state().navigation.current.id, 'rows');

  await assert.rejects(
    console.exec('filter', {
      input: rows,
      where: { field: 'does.not.exist', equals: true },
    }),
    (error) => error instanceof FlightCommandError
      && error.code === 'INVALID_OPERATION',
  );
  await controller.close();
});

test('sensors only observe and movements expose every ordinary command', async () => {
  const { controller, console } = fixture();
  const field = await console.exec('select', {
    scope: 'corpus',
    kinds: [1],
    as: 'field',
    placement: 'home',
  });
  const aperture = await console.movement('diversity-aperture', {
    field,
    maxLocalNotes: 2,
    sampleLimit: 2,
    seed: 'fixture',
    as: 'sample',
  });
  const panel = await console.sense(aperture.result, 'identities', {
    previewLimit: 2,
  });

  assert.equal(aperture.result.handle.id, 'sample');
  assert.equal(aperture.outputs.accounts.handle.kind, 'accounts');
  assert.equal(aperture.outputs.authors.handle.kind, 'relation');
  assert.deepEqual(
    aperture.steps.map(({ operation }) => operation),
    ['relate', 'aggregate', 'filter', 'extract', 'sample'],
  );
  assert.equal(panel.sensor, 'identities');
  assert.equal(panel.input, 'sample');
  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'relate', 'aggregate', 'filter', 'extract', 'sample', 'show'],
  );
  await controller.close();
});

function event(secret, createdAt, content, tags = []) {
  return finalizeEvent({ kind: 1, created_at: createdAt, tags, content }, secret);
}
