import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createCockAndBallsComposer } from '@nostrarium/cock-and-balls-composer';

test('the probe retracts while both bounded reservoirs retain selected evidence', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const composer = createCockAndBallsComposer({
    controller,
    limits: { reservoirEntries: 1, shaftLength: 4 },
  });
  const root = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'root',
  });
  composer.setRoot(root, 'safe base');
  const landing = await composer.thrust({
    command: 'sample',
    input: 'root',
    parameters: { limit: 1, seed: 'probe' },
    resultId: 'landing',
  });
  composer.pull('left', 'first specimen');
  composer.pull('right', 'second reading of the same specimen');
  composer.retract();

  const state = composer.sensors();
  assert.equal(landing.receipt.handle.id, 'landing');
  assert.equal(state.root.id, 'root');
  assert.equal(state.probe.tip.id, 'root');
  assert.equal(state.balls.left.entries[0].handle.id, 'landing');
  assert.equal(state.balls.right.entries[0].handle.id, 'landing');
  await controller.close();
});
