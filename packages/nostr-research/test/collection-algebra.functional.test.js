import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  executeResearchOperation,
  executeResearchPlan,
  operationSchema,
  preflightResearchOperation,
} from '@nostr-research/memory';

const KEY = Uint8Array.from(Buffer.from('1'.repeat(64), 'hex'));

test('direct, plan, and session execution share operation kinds and failure boundaries', async () => {
  const event = finalizeEvent({
    kind: 1, created_at: 1, tags: [], content: 'shared executor',
  }, KEY);
  const memory = createInMemoryResearchMemory({ capacity: 4 });
  memory.ingest(event, { relay: 'wss://fixture.example/' });
  const operation = { operation: 'select', parameters: { scope: 'corpus', kinds: [1] } };

  const descriptor = preflightResearchOperation(memory, operation);
  const direct = await executeResearchOperation(memory, operation);
  const plan = await executeResearchPlan(memory, [{ id: 'notes', ...operation }]);
  const session = createDeclarativeResearchSession(memory);
  const command = await session.execute({
    commandId: 'notes', command: 'select', parameters: operation.parameters, resultId: 'notes',
  });

  assert.equal(descriptor.resultKind, 'events');
  assert.equal(direct.kind, 'events');
  assert.equal(plan.stages[0].resultKind, 'events');
  assert.equal(command.result.handle.kind, 'events');
  assert.equal(operationSchema().definitions.select.locality, 'local');

  const revision = session.revision;
  const failed = await session.execute({
    commandId: 'bad', command: 'select', parameters: { kinds: [1] }, resultId: 'bad',
  });
  assert.equal(failed.ok, false);
  assert.equal(session.revision, revision);
  assert.equal((await session.execute({
    commandId: 'handles', command: 'list', parameters: { limit: 20 },
  })).result.preview.some(({ id }) => id === 'bad'), false);
  memory.close();
});

test('collections navigate identities while relations own value analysis', async () => {
  const events = [1, 2, 3].map((createdAt) => finalizeEvent({
    kind: 1, created_at: createdAt, tags: [], content: `note ${createdAt}`,
  }, KEY));
  const memory = createInMemoryResearchMemory({ capacity: 4 });
  for (const event of events) memory.ingest(event, { relay: 'wss://fixture.example/' });

  const report = await executeResearchPlan(memory, [
    { id: 'notes', operation: 'select', parameters: { scope: 'corpus', kinds: [1] } },
    { id: 'rows', operation: 'relate', input: 'notes', parameters: {} },
    {
      id: 'recent', operation: 'filter', input: 'rows',
      parameters: { where: { field: 'event.createdAt', gte: 2 } },
    },
    {
      id: 'ordered', operation: 'sort', input: 'recent',
      parameters: { by: [{ field: 'event.createdAt', direction: 'descending' }] },
    },
    { id: 'window', operation: 'slice', input: 'ordered', parameters: { offset: 0, limit: 1 } },
  ]);

  assert.deepEqual(report.stages.map(({ resultKind }) => (
    resultKind
  )), ['events', 'relation', 'relation', 'relation', 'relation']);
  assert.equal(report.stages.at(-1).result.rows[0].subjects[0].id, events[2].id);
  assert.throws(() => memory.transform(report.stages[0].result, {
    operation: 'project', fields: ['event.createdAt'],
  }), /Unsupported transform operation/);
  assert.equal(operationSchema().definitions.project.executor, 'relation');
  memory.close();
});
