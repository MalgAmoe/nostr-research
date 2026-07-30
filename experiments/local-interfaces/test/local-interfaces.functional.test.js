import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createFlightConsole } from '@nostrarium/flight-console';
import {
  createContextPalette,
  createFourChannelDock,
} from '@nostrarium/local-interfaces';

test('local palette and dock expose the same engine route without hidden commands', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const secret = Uint8Array.from({ length: 32 }, () => 7);
  memory.ingest(
    finalizeEvent({
      kind: 1, created_at: 1, tags: [], content: 'hello',
    }, secret),
    { relay: 'wss://fixture.invalid/' },
  );
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 100, maxBytes: 300_000 },
  });
  const flight = createFlightConsole({ controller, namePrefix: 'local' });
  const field = await flight.exec('select', {
    scope: 'corpus', kinds: [1], as: 'field', placement: 'home',
  });

  const palettes = createContextPalette({ flight });
  const palette = await palettes.open(field);
  assert.equal(palette.controls.some(({ id }) => id === 'move:authors'), true);
  const paletteAuthors = await palette.invoke('move:authors', { as: 'palette-authors' });
  assert.equal(paletteAuthors.handle.kind, 'accounts');

  const docks = createFourChannelDock({ flight });
  const dockAuthors = await docks.dock(field).go('authors', { as: 'dock-authors' });
  assert.equal(dockAuthors.handle.kind, 'accounts');

  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'schema', 'schema', 'schema', 'move', 'move'],
  );
  await controller.close();
});
