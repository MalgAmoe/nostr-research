import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

test('declarative observation and lifecycle form one bounded public workflow', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 3 });
  const session = createDeclarativeResearchSession(memory);
  const [event] = loadFixtureEvents();
  memory.ingest(event, {
    relay: 'wss://fixture.example/',
    observedAt: '2026-07-26T10:00:00.000Z',
  });

  const selected = await session.execute({
    commandId: 'select',
    command: 'select',
    parameters: { scope: 'corpus', ids: [event.id] },
    resultId: 'finding',
  });
  assert.equal(selected.sessionRevision, 1);

  const shown = await session.execute({
    commandId: 'show',
    ifRevision: 1,
    command: 'show',
    input: 'finding',
    parameters: { mode: 'preview', previewLimit: 1, excerptLimit: 40 },
  });
  assert.equal(shown.result.type, 'result-collection');
  assert.equal(shown.result.count, 1);
  assert.equal(shown.sessionRevision, 1);

  const inspected = await session.execute({
    commandId: 'inspect',
    command: 'inspect',
    parameters: {
      subject: { type: 'event', id: event.id },
      includeEvidence: true,
      excerptLimit: 40,
    },
  });
  assert.equal(inspected.result.resident, true);
  assert.equal(inspected.result.evidence.event.content.length <= 40, true);
  assert.equal(inspected.sessionRevision, 1);

  const explained = await session.execute({
    commandId: 'explain',
    command: 'explain',
    input: 'finding',
    parameters: {
      subject: { type: 'event', id: event.id },
      previewLimit: 1,
    },
  });
  assert.equal(explained.result.member, true);
  assert.equal(explained.result.reasons.length, 1);
  assert.equal(explained.sessionRevision, 1);

  const retained = await session.execute({
    commandId: 'retain',
    command: 'retain',
    input: 'finding',
    parameters: { name: 'kept independently' },
    resultId: 'retained',
  });
  assert.equal(retained.sessionRevision, 2);
  const retainedId = retained.result.handle.id;
  const setId = memory.listSets()[0].id;
  assert.equal(retainedId, 'retained');

  const listed = await session.execute({
    commandId: 'list',
    command: 'list',
    parameters: { limit: 1 },
  });
  assert.equal(listed.result.count, 2);
  assert.equal(listed.result.omitted, 1);
  assert.equal(listed.sessionRevision, 2);

  const released = await session.execute({
    commandId: 'release',
    command: 'release',
    input: 'retained',
    parameters: {},
  });
  assert.equal(released.sessionRevision, 3);
  assert.equal(memory.getEvent(event.id).event.id, event.id);
  assert.equal(memory.getSet(setId).id, setId);

  const status = await session.execute({
    commandId: 'status',
    command: 'status',
    parameters: {},
  });
  assert.equal(status.result.revision, 3);
  assert.equal(status.result.handleCount, 1);
  assert.equal(status.result.retainedSetCount, 1);
  assert.equal(status.sessionRevision, 3);

  const reset = await session.execute({
    commandId: 'reset',
    ifRevision: 3,
    command: 'reset',
    parameters: {},
  });
  assert.equal(reset.sessionRevision, 4);
  assert.equal(memory.describe().eventCount, 0);
  assert.deepEqual(memory.listSets(), []);

  const closed = await session.execute({
    commandId: 'close',
    command: 'close',
    parameters: {},
  });
  assert.equal(closed.sessionRevision, 5);
  const rejected = await session.execute({
    commandId: 'after-close',
    command: 'status',
    parameters: {},
  });
  assert.equal(rejected.error.code, 'SESSION_CLOSED');
  assert.equal(rejected.sessionRevision, 5);
});

test('declarative show bounds grouped and summarized named results', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 3 });
  const session = createDeclarativeResearchSession(memory);
  const [event] = loadFixtureEvents();
  memory.ingest(event, {
    relay: 'wss://fixture.example/',
    observedAt: '2026-07-26T10:00:00.000Z',
  });

  await session.execute({
    commandId: 'notes',
    command: 'select',
    parameters: { scope: 'corpus', ids: [event.id] },
    resultId: 'notes',
  });
  await session.execute({
    commandId: 'authors',
    command: 'group',
    input: 'notes',
    parameters: { by: 'event.author', limit: 3, itemLimit: 3 },
    resultId: 'authors',
  });
  await session.execute({
    commandId: 'totals',
    command: 'summarize',
    input: 'authors',
    parameters: {
      aggregations: [{ name: 'count', operation: 'count' }],
      limit: 3,
    },
    resultId: 'totals',
  });

  const grouped = await session.execute({
    commandId: 'show-authors',
    command: 'show',
    input: 'authors',
    parameters: { previewLimit: 1 },
  });
  assert.equal(grouped.ok, true);
  assert.equal(grouped.result.kind, 'groups');
  assert.equal(grouped.result.preview[0].count, 1);
  assert.equal(grouped.result.preview[0].omitted, 0);

  const summarized = await session.execute({
    commandId: 'show-totals',
    command: 'show',
    input: 'totals',
    parameters: { mode: 'summary' },
  });
  assert.equal(summarized.ok, true);
  assert.equal(summarized.result.kind, 'summaries');
  assert.equal(summarized.result.preview.length, 0);
  assert.equal(summarized.result.omitted, 1);
  assert.equal(summarized.sessionRevision, 3);

  await session.close();
});

test('declarative named results compose compatible sets and expose their schema', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 3 });
  const session = createDeclarativeResearchSession(memory);
  const [event] = loadFixtureEvents();
  memory.ingest(event, {
    relay: 'wss://fixture.example/',
    observedAt: '2026-07-26T10:00:00.000Z',
  });
  await session.execute({
    commandId: 'left', command: 'select',
    parameters: { scope: 'corpus', kinds: [event.kind] }, resultId: 'left',
  });
  await session.execute({
    commandId: 'right', command: 'select',
    parameters: { scope: 'corpus', ids: [event.id] }, resultId: 'right',
  });
  const compared = await session.execute({
    commandId: 'compare', command: 'compare', input: 'left',
    parameters: { with: 'right', limit: 10 }, resultId: 'comparison',
  });
  assert.equal(compared.ok, true);
  assert.equal(compared.result.handle.kind, 'summaries');
  const shown = await session.execute({
    commandId: 'show', command: 'show', input: 'comparison', parameters: {},
  });
  assert.deepEqual(shown.result.preview[0].values, {
    left: 1, right: 1, shared: 1, leftOnly: 0, rightOnly: 0,
  });
  assert.deepEqual(shown.result.truncation, {
    truncated: false,
    omittedItems: 0,
    sourceOmittedItems: 0,
    operationBounds: {
      leftCount: 1, rightCount: 1, outputCount: 1,
      omittedCount: 0, truncated: false,
    },
  });
  assert.equal(shown.result.corpus.capacity, 3);
  assert.equal(shown.result.corpus.residentEvents, 1);
  assert.equal(shown.result.corpus.evictions, 0);
  assert.equal(shown.result.corpus.subjectEffects.available, false);
  const schema = await session.execute({
    commandId: 'schema', command: 'schema', parameters: {},
  });
  assert.equal(schema.ok, true);
  assert.ok(schema.result.operations.set.operations.includes('difference'));
  assert.equal(schema.sessionRevision, 3);
  await session.close();
});

test('declarative judgments and retained selections survive explicit workspace lifecycle', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 3 });
  const session = createDeclarativeResearchSession(memory);
  const [interestedEvent, uninterestedEvent] = loadFixtureEvents();
  for (const event of [interestedEvent, uninterestedEvent]) {
    memory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-27T10:00:00.000Z',
    });
  }

  await session.execute({
    commandId: 'positive-source', command: 'select',
    parameters: { scope: 'corpus', ids: [interestedEvent.id] }, resultId: 'positive-source',
  });
  await session.execute({
    commandId: 'negative-source', command: 'select',
    parameters: { scope: 'corpus', ids: [uninterestedEvent.id] }, resultId: 'negative-source',
  });
  const positiveJudgment = await session.execute({
    commandId: 'judge-positive', command: 'annotate', input: 'positive-source',
    parameters: {
      judgment: 'interested', strength: 0.8, reason: 'Relevant first-hand example',
    },
  });
  assert.equal(positiveJudgment.ok, true);
  const negativeJudgment = await session.execute({
    commandId: 'judge-negative', command: 'annotate', input: 'negative-source',
    parameters: {
      judgment: 'uninterested', reason: 'Useful counterexample, outside this inquiry',
    },
  });
  assert.equal(negativeJudgment.ok, true);

  await session.execute({
    commandId: 'positives', command: 'annotations',
    parameters: { judgments: ['interested'] }, resultId: 'positives',
  });
  await session.execute({
    commandId: 'negatives', command: 'annotations',
    parameters: { judgments: ['uninterested'] }, resultId: 'negatives',
  });
  const constrained = await session.execute({
    commandId: 'constraint', command: 'difference', input: 'positives',
    parameters: { with: 'negatives', limit: 10 }, resultId: 'constrained',
  });
  assert.equal(constrained.result.handle.count, 1);
  assert.equal(
    memory.getAnnotation({ type: 'event', id: interestedEvent.id }).reason,
    'Relevant first-hand example',
  );

  const retained = await session.execute({
    commandId: 'retain', command: 'retain', input: 'constrained',
    parameters: { name: 'provisional examples' }, resultId: 'retained-handle',
  });
  assert.deepEqual(retained.warnings, []);
  const setId = memory.listSets()[0].id;
  await session.execute({
    commandId: 'rename', command: 'rename-set',
    parameters: { id: setId, name: 'reviewed provisional examples' },
  });
  const replaced = await session.execute({
    commandId: 'replace', command: 'replace-set', input: 'negatives',
    parameters: {
      id: setId,
      reason: { type: 'explicit-negative-example', provisional: true },
    },
  });
  assert.equal(replaced.result.memberCount, 1);
  assert.equal(memory.getSet(setId).members[0].id, uninterestedEvent.id);

  const released = await session.execute({
    commandId: 'release', command: 'release', input: 'retained-handle', parameters: {},
  });
  assert.equal(released.result.type, 'released-result-handle');
  const inspectedSet = await session.execute({
    commandId: 'inspect-set', command: 'set', parameters: { id: setId },
  });
  assert.equal(inspectedSet.result.name, 'reviewed provisional examples');

  const template = await session.execute({
    commandId: 'template', command: 'template', input: 'positives',
    parameters: { name: 'accounts-from-notes', limit: 2 }, resultId: 'authors',
  });
  assert.deepEqual(template.result.expansion, {
    operation: 'move', parameters: { to: 'authors', limit: 2 },
  });

  await session.execute({
    commandId: 'empty', command: 'difference', input: 'positives',
    parameters: { with: 'positives', limit: 10 }, resultId: 'empty',
  });
  const invalidEmptyRetention = await session.execute({
    commandId: 'retain-empty-invalid', command: 'retain', input: 'empty',
    parameters: { name: 'invalid empty selection', callback: '() => process.exit()' },
  });
  assert.equal(invalidEmptyRetention.error.code, 'INVALID_OPERATION');
  const refusedEmptyRetention = await session.execute({
    commandId: 'retain-empty', command: 'retain', input: 'empty',
    parameters: { name: 'deliberately empty selection' },
  });
  assert.equal(refusedEmptyRetention.error.code, 'EMPTY_RESULT');
  const emptyRetention = await session.execute({
    commandId: 'retain-empty-explicitly', command: 'retain', input: 'empty',
    parameters: { name: 'deliberately empty selection', allowEmpty: true },
  });
  assert.match(emptyRetention.warnings[0], /retained selection is empty/i);

  const bulkReleased = await session.execute({
    commandId: 'release-all', command: 'release-all', parameters: {},
  });
  assert.ok(bulkReleased.result.count > 0);
  assert.equal(memory.listSets().length, 2);
  await session.execute({
    commandId: 'delete', command: 'delete-set', parameters: { id: setId },
  });
  assert.equal(memory.listSets().length, 1);

  const schema = await session.execute({
    commandId: 'schema', command: 'schema', parameters: {},
  });
  assert.equal(schema.result.session.accountFields['account.name'], 'literal Nostr kind-0 profile field "name"');
  assert.match(schema.result.session.retainedSets.distinction, /release-all.*delete-set/);

  await session.close();
});
