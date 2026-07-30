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
  createBridgeCockpit,
  createExpeditionCockpit,
  createParallaxCockpit,
} from '@nostrarium/overlap-cockpits';

test('overlapping cockpits add finite attention, contrast, and inquiry over ordinary commands', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  const first = Uint8Array.from({ length: 32 }, () => 3);
  const second = Uint8Array.from({ length: 32 }, () => 4);
  for (const [secret, createdAt, content] of [
    [first, 1, 'one'],
    [first, 2, 'two'],
    [second, 3, 'three'],
  ]) {
    memory.ingest(
      finalizeEvent({ kind: 1, created_at: createdAt, tags: [], content }, secret),
      { relay: 'wss://fixture.invalid/' },
    );
  }
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 200, maxBytes: 500_000 },
  });
  const flight = createFlightConsole({ controller, namePrefix: 'overlap' });
  const field = await flight.exec('select', {
    scope: 'corpus', kinds: [1], as: 'field', placement: 'home',
  });

  const bridge = createBridgeCockpit({ flight, actionLimit: 2 });
  bridge.board(field, { ask: 'Who speaks here?' });
  bridge.mount('ground', { sensor: 'structure' });
  bridge.mount('voices', {
    follow: 'current', sensor: 'preview', options: { previewLimit: 2 },
  });
  const bridgeRead = await bridge.read();
  const bridgeMove = await bridge.gate({
    kind: 'go', route: 'authors', options: { as: 'bridge-authors' },
  });
  assert.equal(bridgeRead.panels.length, 2);
  assert.equal('raw' in bridgeRead.panels[0].observation, false);
  assert.equal(bridgeMove.state.current.kind, 'accounts');
  assert.equal(
    (await bridge.read()).panels[1].observation.input,
    bridgeMove.state.current.id,
  );
  const chart = await bridge.chart();
  assert.equal('invoke' in chart, false);
  const controlled = await bridge.gate({
    kind: 'control',
    control: 'shape:sample',
    parameters: { limit: 1, seed: 'controlled', as: 'controlled' },
  });
  assert.equal(controlled.state.current.id, 'controlled');
  bridge.returnHome();
  assert.equal(bridge.state().omittedActions, 1);

  const sample = await flight.exec('sample', {
    input: field, limit: 1, seed: 'parallax', as: 'sample',
  });
  const parallax = createParallaxCockpit({ flight });
  parallax.place('left', field, 'structure');
  parallax.place('right', sample, 'structure');
  const difference = await parallax.combine('difference', { as: 'difference' });
  assert.equal(difference.handle.count, 2);

  const expedition = createExpeditionCockpit({ flight, logLimit: 3 });
  expedition.depart(field, 'Can diversity reveal a useful doorway?');
  const aperture = await expedition.maneuver('diversity-aperture', {
    maxLocalNotes: 2,
    sampleLimit: 2,
    as: 'expedition-sample',
  });
  expedition.collect('candidate cross-section');
  assert.equal(aperture.steps.length, 5);
  assert.equal(expedition.state().cargo.entries.length, 1);
  assert.equal(expedition.state().questions[0].evidence.length, 1);
  assert.equal(expedition.state().activeQuestion.evidence.length, 1);
  expedition.adopt(field, 'one');
  expedition.adopt(aperture.result, 'two');
  assert.equal(expedition.state().log.length, 3);
  assert.equal(expedition.state().omittedLog, 2);

  await controller.close();
});
