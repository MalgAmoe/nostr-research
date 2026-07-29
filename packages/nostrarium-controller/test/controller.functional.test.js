import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { createNavigatorController } from '@nostrarium/controller';

test('public session commands are sequential, correlated, unchanged, and explicitly synchronized', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const session = createDeclarativeResearchSession(memory);
  let active = 0;
  let maximumActive = 0;
  const sent = [];
  const controller = createNavigatorController({
    request: async (command) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      sent.push(structuredClone(command));
      await Promise.resolve();
      const response = await session.execute(command);
      active -= 1;
      return response;
    },
    transcript: { maxEntries: 20, maxBytes: 100_000 },
  });

  const draft = {
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'notes',
  };
  const selectedPromise = controller.execute(draft);
  const failedPromise = controller.execute({
    command: 'show', input: 'missing', parameters: { mode: 'summary' },
  });
  const selected = await selectedPromise;
  const failed = await failedPromise;

  assert.equal(maximumActive, 1);
  assert.deepEqual(
    { ...sent[0], commandId: undefined },
    { ...draft, commandId: undefined },
  );
  assert.equal(selected.response.ok, true);
  assert.deepEqual(selected.receipt.handle, {
    id: 'notes', kind: 'events', count: 0, scope: 'corpus',
  });
  assert.equal(failed.response.ok, false);
  assert.deepEqual(failed.receipt.error, {
    code: 'UNKNOWN_RESULT', message: 'No named result exists for missing.',
  });

  assert.equal(controller.state().handleCatalog, null);
  const synchronized = await controller.synchronize();
  assert.equal(synchronized.list.response.ok, true);
  assert.equal(synchronized.status.response.ok, true);
  assert.deepEqual(sent.slice(-2).map(({ command }) => command), ['list', 'status']);
  assert.deepEqual(
    controller.state().handleCatalog.preview.map(({ id }) => id),
    ['notes'],
  );
  assert.equal(controller.state().handleCatalog.count, 1);
  assert.equal(controller.state().handleCatalog.omitted, 0);
  assert.equal(controller.state().catalogStale, false);

  await controller.execute({
    command: 'release', input: 'notes', parameters: {},
  });
  assert.equal(controller.state().catalogStale, true);
  assert.deepEqual(
    controller.state().handleCatalog.preview.map(({ id }) => id),
    ['notes'],
  );
  await assert.rejects(
    controller.execute({ commandId: 'caller-id', command: 'status' }),
    /must not contain commandId/,
  );

  await controller.close();
});

test('synchronized handle catalog preserves bounded list metadata', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const session = createDeclarativeResearchSession(memory);
  const controller = createNavigatorController({
    request: (command) => session.execute(command),
    transcript: { maxEntries: 20, maxBytes: 100_000 },
  });

  for (let index = 0; index < 6; index += 1) {
    const outcome = await controller.execute({
      command: 'select',
      parameters: { scope: 'corpus', kinds: [index] },
      resultId: `result-${index}`,
    });
    assert.equal(outcome.response.ok, true);
  }

  await controller.synchronize();
  const { handleCatalog } = controller.state();
  assert.equal(handleCatalog.count, 6);
  assert.equal(handleCatalog.preview.length, 5);
  assert.equal(handleCatalog.omitted, 1);

  await controller.close();
});

test('receipts expose declared external facts and transcript bounds account for omissions', async () => {
  const responses = [];
  const controller = createNavigatorController({
    request: async (command) => {
      const response = {
        ok: true,
        commandId: command.commandId,
        sessionRevision: responses.length + 1,
        result: {
          handle: {
            id: 'external', kind: 'events', count: 2, revision: 1,
            scope: 'subject-collection',
          },
          external: {
            status: 'partial',
            completeness: { boundsReached: ['observation-limit'] },
            ignored: 'not a receipt fact',
          },
          large: 'x'.repeat(2_000),
        },
        warnings: ['The bounded attempt was partial.'],
      };
      responses.push(response);
      return response;
    },
    transcript: { maxEntries: 1, maxBytes: 500 },
  });

  const outcome = await controller.execute({ command: 'acquire', parameters: {} });
  assert.equal(outcome.response, responses[0]);
  assert.deepEqual(outcome.receipt.external, {
    status: 'partial', boundsReached: ['observation-limit'],
  });
  assert.equal(outcome.receipt.warningCount, 1);
  assert.deepEqual(outcome.receipt.warnings, ['The bounded attempt was partial.']);
  assert.equal(controller.transcript().entries.length, 0);
  assert.equal(controller.state().transcript.omittedEntries, 1);
  assert.ok(controller.state().transcript.omittedBytes > 2_000);
  assert.ok(controller.state().transcript.retainedBytes <= 500);
});

test('transport and correlation failures reject after recording, and close is idempotent', async () => {
  let calls = 0;
  let transportCloses = 0;
  const controller = createNavigatorController({
    request: async (command) => {
      calls += 1;
      if (calls === 1) throw new Error('transport unavailable');
      return {
        ok: true,
        commandId: calls === 2 ? 'wrong-command' : command.commandId,
        sessionRevision: 0,
        result: {},
        warnings: [],
      };
    },
    closeTransport: async () => {
      transportCloses += 1;
    },
    transcript: { maxEntries: 10, maxBytes: 20_000 },
  });

  await assert.rejects(controller.execute({ command: 'status' }), /transport unavailable/);
  await assert.rejects(
    controller.execute({ command: 'status' }),
    { name: 'NavigatorControllerCorrelationError' },
  );
  assert.equal(controller.transcript().entries.length, 2);
  assert.equal(controller.transcript().entries[0].response, undefined);
  assert.equal(controller.transcript().entries[1].response.commandId, 'wrong-command');
  assert.equal(controller.state().latestTransportFailure.name,
    'NavigatorControllerCorrelationError');

  const firstClose = controller.close();
  const secondClose = controller.close();
  assert.equal(firstClose, secondClose);
  const closed = await firstClose;
  assert.equal(closed.response.ok, true);
  assert.equal(transportCloses, 1);
  assert.equal(controller.state().lifecycle, 'closed');
  await assert.rejects(
    controller.execute({ command: 'status' }),
    { name: 'NavigatorControllerLifecycleError' },
  );
});
