import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createDarkroomComposer } from '@nostrarium/darkroom-composer';

test('a developed negative preserves both visible exposures and their contrast', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const darkroom = createDarkroomComposer({ controller });
  const field = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'field',
  });
  darkroom.setGround(field, 'shared source');
  const question = darkroom.addQuestion('Which framing changes what becomes visible?');
  const result = await darkroom.develop({
    label: 'two samples',
    questionId: question.id,
    a: {
      command: 'sample',
      input: 'field',
      parameters: { limit: 1, seed: 'a' },
      resultId: 'exposure-a',
    },
    b: {
      command: 'sample',
      input: 'field',
      parameters: { limit: 2, seed: 'b' },
      resultId: 'exposure-b',
    },
  });

  assert.equal(result.sensors.ground.id, 'field');
  assert.equal(result.negative.a.outcome.handle.id, 'exposure-a');
  assert.equal(result.negative.b.outcome.handle.id, 'exposure-b');
  assert.equal(result.negative.contrast.countDifference, 0);
  assert.equal(result.negative.contrast.groundCount, 0);
  assert.equal(result.negative.contrast.aShare, null);
  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'sample', 'sample'],
  );
  await controller.close();
});
