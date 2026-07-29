import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createPinballComposer } from '@nostrarium/pinball-composer';

test('the table stays safe while each collision moves the ball', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const pinball = createPinballComposer({ controller });
  const field = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'field',
  });
  pinball.setTable(field, 'safe board');
  const curiosity = pinball.addCuriosity('What happens if I hit a tiny sample?');
  const hit = await pinball.fire({
    command: 'sample',
    input: 'field',
    parameters: { limit: 1, seed: 'pinball' },
    resultId: 'ball-1',
  }, { curiosityId: curiosity.id });

  assert.equal(hit.sensors.table.id, 'field');
  assert.equal(hit.sensors.momentum.ball.id, 'ball-1');
  assert.equal(hit.sensors.curiosities[0].hits, 1);
  assert.equal(hit.collision.from.id, 'field');
  assert.equal(hit.collision.landed.id, 'ball-1');
  await controller.close();
});
