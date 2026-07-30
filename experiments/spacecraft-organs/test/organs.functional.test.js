import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import {
  createComparison,
  createNavigator,
  createQuestions,
  createReservoirs,
} from '@nostrarium/spacecraft-organs';

test('independent organs share ordinary handles without reducing commands', async () => {
  const session = createDeclarativeResearchSession(
    createInMemoryResearchMemory({ capacity: 10 }),
  );
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 30, maxBytes: 200_000 },
  });
  const navigator = createNavigator({ controller });
  const questions = createQuestions();
  const reservoirs = createReservoirs();
  const comparison = createComparison();

  const root = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'root',
  });
  navigator.attach(root, 'home', 'shared base');
  navigator.attach(root, 'current', 'board');
  const question = questions.open('What changes under two selections?');
  const sample = await navigator.execute({
    command: 'sample',
    input: 'root',
    parameters: { limit: 1, seed: 'organs' },
    resultId: 'sample',
  }, { result: 'current', reason: 'sample landing' });
  reservoirs.create('specimens');
  reservoirs.pull('specimens', sample, 'selected sample');
  comparison.attach('A', root, 'whole');
  comparison.attach('B', sample, 'sample');
  questions.attach(question.id, sample, 'candidate evidence');
  for (let index = 0; index < 20; index += 1) {
    questions.attach(question.id, sample, `additional evidence ${index}`);
  }

  assert.equal(navigator.state().home.id, 'root');
  assert.equal(navigator.state().current.id, 'sample');
  assert.equal(reservoirs.state()[0].entries[0].handle.id, 'sample');
  assert.equal(comparison.state().B.handle.id, 'sample');
  assert.equal(questions.state()[0].evidence[0].handle.id, 'sample');
  assert.equal(questions.state()[0].evidence.length, 20);
  assert.equal(questions.state()[0].omittedEvidence, 1);
  assert.deepEqual(
    controller.transcript().entries.map(({ command }) => command.command),
    ['select', 'sample'],
  );
  await controller.close();
});
