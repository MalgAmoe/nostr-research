import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';
import {
  createVoyageSystemSlice,
  formatVoyageSystemSlice,
} from '@nostrarium/voyage-system-slice';

function signed(secretByte, createdAt, content, tags = []) {
  return finalizeEvent({ kind: 1, created_at: createdAt, tags, content },
    Uint8Array.from({ length: 32 }, () => secretByte));
}

function fixture() {
  const memory = createInMemoryResearchMemory({ capacity: 20 });
  const events = [
    signed(21, 1, 'music question', [['t', 'music']]),
    signed(22, 2, 'garden link https://example.test/garden', [
      ['t', 'garden'], ['r', 'https://example.test/garden'],
    ]),
    signed(23, 3, 'ordinary reply', [['e', '0'.repeat(64)]]),
  ];
  for (const event of events) {
    memory.ingest(event, {
      relay: 'wss://voyage-slice.invalid/',
      observedAt: '2026-08-01T12:00:00.000Z',
    });
  }
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 200, maxBytes: 500_000 },
  });
  return {
    controller,
    events,
    system: createVoyageSystemSlice({ controller, branchLimit: 3 }),
  };
}

async function execute(controller, command) {
  return controller.execute(command);
}

async function establishGround(system, controller) {
  system.stage({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'ground',
  });
  const source = await system.executeStaged();
  system.placePending({
    destination: 'ground',
    key: 'ground',
    label: 'Fixture Ground',
    reason: 'Three bounded fixture notes.',
  });
  return source;
}

test('staged commands remain unchanged and successful execution never places its result', async () => {
  const { controller, system } = fixture();
  await establishGround(system, controller);
  const draft = {
    command: 'sample',
    input: 'ground',
    parameters: { limit: 1, seed: 'pending-branch' },
    resultId: 'sampled',
  };

  system.stage(draft);
  assert.deepEqual(system.snapshot().actionGate.staged, draft);
  const executed = await system.executeStaged();
  assert.deepEqual(executed.command, draft);
  assert.deepEqual(system.snapshot().actionGate.lastExecution.command, draft);
  assert.equal(system.snapshot().actionGate.pending.handle.id, 'sampled');
  assert.equal(system.snapshot().position.branches.length, 0);
  assert.equal(system.focusedHandle().id, 'ground');

  system.placePending({
    destination: 'branch',
    key: 'sample',
    label: 'One sampled note',
    reason: 'A navigator-chosen bounded sample.',
  });
  assert.equal(system.snapshot().actionGate.pending, null);
  assert.equal(system.snapshot().position.branches[0].handle.id, 'sampled');
  assert.equal(system.focusedHandle().id, 'ground');

  system.focus('sample', 'Inspect the sampled branch.');
  assert.equal(system.focusedHandle().id, 'sampled');

  system.stage({
    command: 'limit', input: 'ground', parameters: { limit: 2 }, resultId: 'replacement',
  });
  await system.executeStaged();
  const replacementSummaryCommand = {
    command: 'show', input: 'replacement', parameters: { mode: 'summary' },
  };
  const replacementSummary = await system.raw.execute(replacementSummaryCommand);
  const replaced = system.placePending({
    destination: 'replace-branch',
    key: 'sample',
    label: 'Two replacement notes',
    reason: 'The navigator revised this stable branch slot.',
    observation: {
      command: replacementSummaryCommand,
      outcome: replacementSummary,
    },
  });
  assert.equal(replaced.placed.displaced.id, 'sampled');
  assert.equal(replaced.placed.handle.id, 'replacement');
  assert.equal(system.focusedHandle().id, 'sampled');
  assert.equal(system.snapshot().position.focusLocation, 'outside-field');
  assert.match(formatVoyageSystemSlice(system.snapshot()), /PENDING · none/u);
  await controller.close();
});

test('discard is explicit and does not make an ordinary result handle unusable outside the system', async () => {
  const { controller, system } = fixture();
  await establishGround(system, controller);
  system.stage({
    command: 'limit', input: 'ground', parameters: { limit: 2 }, resultId: 'temporary',
  });
  await system.executeStaged();
  const discarded = system.discardPending('Not useful for this voyage position.');

  assert.equal(discarded.discarded.handle.id, 'temporary');
  assert.equal(discarded.discarded.engineReleaseIssued, false);
  assert.equal(system.snapshot().actionGate.pending, null);
  const outside = await controller.execute({
    command: 'show', input: discarded.discarded.handle.id, parameters: { mode: 'summary' },
  });
  assert.equal(outside.response.ok, true);
  assert.equal(outside.response.result.summary.count, 2);

  system.stage({
    command: 'preserve',
    input: 'ground',
    parameters: { level: 'reference', reason: { type: 'voyage-trial' } },
  });
  const preserved = await system.executeStaged();
  assert.equal(preserved.outcome.response.ok, true);
  assert.equal(system.snapshot().actionGate.pending, null);
  const status = await controller.execute({ command: 'status', parameters: {} });
  assert.equal(status.response.result.archive.entryCount, 3);
  await controller.close();
});

test('questions, evidence, and relation lenses share one focus and consume only explicit observations', async () => {
  const { controller, events, system } = fixture();
  await establishGround(system, controller);
  const { question } = system.addQuestion('Which visible structures deserve a closer check?');
  system.attachQuestion(question.id, {
    handle: system.focusedHandle(),
    reason: 'The question arose from this bounded field.',
  });
  const exact = system.attachQuestion(question.id, {
    subject: { type: 'event', id: events[1].id, kind: 1 },
    reason: 'This exact link-bearing note is one candidate.',
  });

  const evidenceCommand = {
    command: 'show', input: 'ground', parameters: { mode: 'preview', previewLimit: 3 },
  };
  const evidenceOutcome = await system.raw.execute(evidenceCommand);
  system.openLens({
    family: 'evidence',
    label: 'Ground notes',
    observations: { command: evidenceCommand, outcome: evidenceOutcome },
  });
  assert.equal(system.snapshot().lens.family, 'evidence');
  assert.equal(system.snapshot().lens.projection.items.length, 3);
  assert.throws(
    () => system.focus({ type: 'event', id: events[1].id }, 'Try another focus.'),
    /Close the active lens/u,
  );
  const beforeClose = system.focusedHandle();
  system.closeLens();
  assert.deepEqual(system.focusedHandle(), beforeClose);

  system.stage({ command: 'relate', input: 'ground', parameters: {}, resultId: 'rows' });
  await system.executeStaged();
  assert.equal(system.focusedHandle().id, 'ground');
  system.placePending({ destination: 'focus', reason: 'Inspect the relation structure.' });
  assert.equal(system.focusedHandle().id, 'rows');

  const relationCommand = {
    command: 'show', input: 'rows', parameters: { mode: 'preview', previewLimit: 3 },
  };
  const schemaCommand = { command: 'schema', input: 'rows', parameters: {} };
  const relationOutcome = await system.raw.execute(relationCommand);
  const schemaOutcome = await system.raw.execute(schemaCommand);
  system.openLens({
    family: 'relation',
    label: 'Ground relation rows',
    observations: [
      { command: relationCommand, outcome: relationOutcome },
      { command: schemaCommand, outcome: schemaOutcome },
    ],
  });
  const relation = system.snapshot();
  assert.equal(relation.position.focus.handle.id, 'rows');
  assert.equal(relation.lens.observations[0].command.input, 'rows');
  assert.equal(Object.hasOwn(relation.lens, 'focus'), false);
  assert.equal(relation.lens.projection.rows.length, 3);
  assert.equal(
    relation.lens.projection.fields.some(({ name }) => name === 'event.author'),
    true,
  );

  system.closeLens();
  system.detachQuestion(question.id, exact.attachment.id);
  system.removeQuestion(question.id);
  const statusCommand = { command: 'status', parameters: {} };
  const statusOutcome = await system.raw.execute(statusCommand);
  system.notice({ command: statusCommand, outcome: statusOutcome });
  assert.equal(system.snapshot().conditions.pressure.handles, 2);
  assert.equal(system.snapshot().questions.length, 0);
  await controller.close();
});
