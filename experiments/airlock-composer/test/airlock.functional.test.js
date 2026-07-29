import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import { createAirlockComposer } from '@nostrarium/airlock-composer';

test('Home is protected while routes pause and alternatives accumulate', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const composer = createAirlockComposer({ controller });

  const home = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'home',
  });
  composer.setHome({ primary: home }, 'safe place');
  composer.addQuestion('What is actually present here?');
  composer.addQuestion('Which absence claims are bounded?');
  composer.stageRoute({
    id: 'sample',
    label: 'Take a small entrance sample',
    steps: [{
      command: 'sample',
      input: 'home',
      parameters: { limit: 1, seed: 'airlock' },
      resultId: 'entrance',
    }],
  });

  const sampled = await composer.executeNext('sample');
  assert.equal(sampled.receipt.handle.id, 'entrance');
  assert.equal(sampled.sensors.home.primary.id, 'home');
  assert.equal(sampled.sensors.alternatives[0].id, 'entrance');
  assert.equal(sampled.airlock.status, 'complete');

  composer.adopt(sampled, 'reference', 'comparison');
  assert.equal(composer.sensors().home.primary.id, 'home');
  assert.equal(composer.sensors().home.references[0].id, 'entrance');
  assert.equal(composer.sensors().home.reason, 'safe place');

  const observed = await composer.observeWeather();
  assert.equal(observed.sensors.weather.facts[0].type, 'home-shape');
  assert.match(observed.sensors.weather.language[0], /Home contains 0 subjects/);
  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'sample', 'show'],
  );

  await controller.close();
});
