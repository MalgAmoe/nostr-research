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

test('collection accounting separates rejected identities from bounded omissions', () => {
  const events = [1, 2, 3].map((createdAt) => finalizeEvent({
    kind: 1, created_at: createdAt, tags: [], content: `identity ${createdAt}`,
  }, KEY));
  const memory = createInMemoryResearchMemory({ capacity: 4 });
  for (const event of events) memory.ingest(event, { relay: 'wss://fixture.example/' });
  const source = memory.select({ ids: events.map(({ id }) => id), order: 'oldest' });
  const subjects = memory.collection([
    ...source.items,
    { subject: { type: 'account', id: events[0].pubkey } },
  ]);
  const equalsEvents = memory.transform(subjects, {
    operation: 'filter',
    where: { field: 'subject.type', equals: 'event' },
    limit: 10,
  });
  const inEvents = memory.transform(subjects, {
    operation: 'filter',
    where: { field: 'subject.type', in: ['event'] },
    limit: 10,
  });
  assert.equal(equalsEvents.kind, 'events');
  assert.equal(inEvents.kind, 'events');
  assert.deepEqual(inEvents.items.map(({ subject }) => subject),
    equalsEvents.items.map(({ subject }) => subject));
  assert.doesNotThrow(() => memory.transform(inEvents, {
    operation: 'move', to: 'authors', limit: 10,
  }));

  const exactFilter = memory.transform(source, {
    operation: 'filter',
    where: { field: 'subject.id', equals: events[0].id },
    limit: 10,
  });
  assert.deepEqual(exactFilter.context.cardinality, {
    inputCount: 3,
    matchedCount: 1,
    rejectedCount: 2,
    outputCount: 1,
    omittedCount: 0,
    outputLimit: 10,
    truncated: false,
  });

  const boundedFilter = memory.transform(source, {
    operation: 'filter',
    where: { field: 'subject.id', in: events.map(({ id }) => id) },
    limit: 2,
  });
  assert.deepEqual(boundedFilter.context.cardinality, {
    inputCount: 3,
    matchedCount: 3,
    rejectedCount: 0,
    outputCount: 2,
    omittedCount: 1,
    outputLimit: 2,
    truncated: true,
  });

  const picked = memory.transform(source, { operation: 'pick', positions: [1, 3] });
  assert.deepEqual(picked.context.cardinality, {
    inputCount: 3,
    outputCount: 2,
    omittedCount: 0,
    truncated: false,
  });
  memory.close();
});

test('relation handles report operation-specific cardinality and proven truncation', async () => {
  const events = [1, 2].map((createdAt) => finalizeEvent({
    kind: 1,
    created_at: createdAt,
    tags: Array.from({ length: 80 }, (_, index) => ['t', `${createdAt}-${index}`]),
    content: `tag source ${createdAt}`,
  }, KEY));
  const memory = createInMemoryResearchMemory({ capacity: 4 });
  for (const event of events) memory.ingest(event, { relay: 'wss://fixture.example/' });
  const session = createDeclarativeResearchSession(memory);
  await session.execute({
    commandId: 'notes', command: 'select',
    parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
  });
  await session.execute({
    commandId: 'rows', command: 'relate', input: 'notes', parameters: {}, resultId: 'rows',
  });

  const exploded = await session.execute({
    commandId: 'explode', command: 'explode', input: 'rows',
    parameters: { field: 'event.tags', as: 'tag' }, resultId: 'exploded',
  });
  assert.deepEqual(exploded.result.handle, {
    id: 'exploded', kind: 'relation', count: 100, revision: 3,
  });
  const explodedCoverage = await session.execute({
    commandId: 'explode-coverage', command: 'show', input: 'exploded',
    parameters: { mode: 'coverage' },
  });
  assert.deepEqual(explodedCoverage.result.coverage.bounds, {
    inputCount: 2,
    outputCount: 100,
    truncated: true,
    outputLimit: 100,
  });
  assert.equal(explodedCoverage.result.coverage.partial, true);

  await session.execute({
    commandId: 'exact', command: 'explode', input: 'rows',
    parameters: { field: 'event.tags', as: 'tag', limit: 160 }, resultId: 'exact',
  });
  const exactSummary = await session.execute({
    commandId: 'exact-summary', command: 'show', input: 'exact',
    parameters: { mode: 'summary' },
  });
  assert.equal(exactSummary.result.context.cardinality.outputCount, 160);
  assert.equal(exactSummary.result.context.cardinality.truncated, false);
  assert.equal('omittedCount' in exactSummary.result.context.cardinality, false);
  assert.deepEqual({
    resultKind: exactSummary.result.summary.resultKind,
    count: exactSummary.result.summary.count,
    countUnit: exactSummary.result.summary.countUnit,
    distinctSubjectCount: exactSummary.result.summary.distinctSubjectCount,
    evidenceSubjectCount: exactSummary.result.summary.evidenceSubjectCount,
    evidenceResolution: exactSummary.result.summary.evidenceResolution,
  }, {
    resultKind: 'research-relation',
    count: 160,
    countUnit: 'rows',
    distinctSubjectCount: 2,
    evidenceSubjectCount: 2,
    evidenceResolution: { buffer: 2, archive: 0, unresolved: 0 },
  });
  assert.deepEqual(exactSummary.result.summary.eventFacts, {
    resolvedEventCount: 2,
    kindHistogram: [{ kind: 1, count: 2 }],
    distinctAuthorCount: 1,
    createdAtRange: { earliest: 1, latest: 2 },
  });
  assert.deepEqual(exactSummary.result.preview, []);

  await session.execute({
    commandId: 'filtered', command: 'filter', input: 'rows',
    parameters: { where: { field: 'event.createdAt', gte: 2 } }, resultId: 'filtered',
  });
  const filtered = await session.execute({
    commandId: 'filtered-summary', command: 'show', input: 'filtered',
    parameters: { mode: 'summary' },
  });
  assert.equal(filtered.result.context.cardinality.rejectedCount, 1);
  assert.equal(filtered.result.context.cardinality.truncated, false);
  assert.equal('omittedCount' in filtered.result.context.cardinality, false);

  await session.execute({
    commandId: 'grouped', command: 'aggregate', input: 'rows',
    parameters: {
      by: [],
      aggregations: [{ name: 'count', operation: 'count' }],
    },
    resultId: 'grouped',
  });
  const grouped = await session.execute({
    commandId: 'grouped-summary', command: 'show', input: 'grouped',
    parameters: { mode: 'summary' },
  });
  assert.equal(grouped.result.context.cardinality.producedGroupCount, 1);
  assert.equal(grouped.result.context.cardinality.retainedGroupCount, 1);
  assert.equal(grouped.result.context.cardinality.truncated, false);
  assert.equal('omittedCount' in grouped.result.context.cardinality, false);
  memory.close();
});
