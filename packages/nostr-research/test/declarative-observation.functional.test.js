import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

const NOTEBOOK_TEST_KEY = Uint8Array.from(Buffer.from('6'.repeat(64), 'hex'));

test('declarative observation and lifecycle form one bounded public workflow', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 1 });
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

  const picked = await session.execute({
    commandId: 'pick',
    command: 'pick',
    input: 'finding',
    parameters: { positions: [1] },
    resultId: 'chosen',
  });
  assert.equal(picked.result.handle.kind, 'events');
  assert.equal(picked.result.handle.count, 1);

  const pickedShown = await session.execute({
    commandId: 'show-picked',
    command: 'show',
    input: 'chosen',
    parameters: { mode: 'summary' },
  });
  assert.deepEqual(pickedShown.result.context, {
    operation: 'transform',
    sourceOperation: 'selection',
    stageCount: 1,
    latestStage: { operation: 'pick', positions: [1] },
    cardinality: {
      inputCount: 1, outputCount: 1, omittedCount: 0, truncated: false,
    },
  });

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
  assert.equal(inspected.sessionRevision, 2);

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
  assert.equal(explained.sessionRevision, 2);

  const retained = await session.execute({
    commandId: 'retain',
    command: 'remember-membership',
    input: 'finding',
    parameters: { name: 'kept independently' },
    resultId: 'retained',
  });
  assert.equal(retained.sessionRevision, 3);
  const retainedId = retained.result.handle.id;
  const setId = memory.listMemberships()[0].id;
  assert.equal(retainedId, 'retained');

  const listed = await session.execute({
    commandId: 'list',
    command: 'list',
    parameters: { limit: 1 },
  });
  assert.equal(listed.result.count, 3);
  assert.equal(listed.result.omitted, 2);
  assert.equal(listed.sessionRevision, 3);

  const released = await session.execute({
    commandId: 'release',
    command: 'release',
    input: 'retained',
    parameters: {},
  });
  assert.equal(released.sessionRevision, 4);
  assert.equal(memory.getEvent(event.id).event.id, event.id);
  assert.equal(memory.getMembership(setId).id, setId);

  const status = await session.execute({
    commandId: 'status',
    command: 'status',
    parameters: {},
  });
  assert.equal(status.result.revision, 4);
  assert.equal(status.result.handleCount, 2);
  assert.equal(status.result.notebook.membershipCount, 1);
  assert.equal(status.sessionRevision, 4);

  const reset = await session.execute({
    commandId: 'reset',
    ifRevision: 4,
    command: 'reset',
    parameters: {},
  });
  assert.equal(reset.sessionRevision, 5);
  assert.equal(memory.describe().observationBuffer.eventCount, 0);
  assert.deepEqual(memory.listMemberships(), []);

  const closed = await session.execute({
    commandId: 'close',
    command: 'close',
    parameters: {},
  });
  assert.equal(closed.sessionRevision, 6);
  const rejected = await session.execute({
    commandId: 'after-close',
    command: 'status',
    parameters: {},
  });
  assert.equal(rejected.error.code, 'SESSION_CLOSED');
  assert.equal(rejected.sessionRevision, 6);
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
  await session.execute({
    commandId: 'left-rows', command: 'relate', input: 'left',
    parameters: {}, resultId: 'left-rows',
  });
  await session.execute({
    commandId: 'right-rows', command: 'relate', input: 'right',
    parameters: {}, resultId: 'right-rows',
  });
  const joined = await session.execute({
    commandId: 'join', command: 'join',
    inputs: { left: 'left-rows', right: 'right-rows' },
    parameters: {
      on: { left: 'subject.id', right: 'subject.id' },
      select: [{ field: 'event.author', name: 'matchedAuthor' }],
    },
    resultId: 'joined',
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.result.handle.kind, 'relation');
  assert.equal(joined.result.handle.count, 1);
  const joinedShown = await session.execute({
    commandId: 'show-joined', command: 'show', input: 'joined', parameters: {},
  });
  assert.equal(joinedShown.result.preview[0].values.matchedAuthor, event.pubkey);
  const joinedPastEnd = await session.execute({
    commandId: 'show-joined-window', command: 'show', input: 'joined',
    parameters: { offset: 1, previewLimit: 1 },
  });
  assert.deepEqual(joinedPastEnd.result.preview, []);
  assert.equal(joinedPastEnd.result.omittedBefore, 1);
  assert.equal(joinedPastEnd.result.omittedAfter, 0);
  const schema = await session.execute({
    commandId: 'schema', command: 'schema', parameters: {},
  });
  assert.equal(schema.ok, true);
  assert.ok(schema.result.operations.set.operations.includes('difference'));
  assert.equal(schema.sessionRevision, 6);
  await session.close();
});

test('declarative notebook knowledge survives turnover and remains independent from evidence', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 2 });
  const session = createDeclarativeResearchSession(memory);
  const [interestedEvent, uninterestedEvent] = loadFixtureEvents();
  memory.ingest(interestedEvent, {
    relay: 'wss://fixture.example/', observedAt: '2026-07-27T10:00:00.000Z',
  });

  await session.execute({
    commandId: 'positive-source', command: 'select',
    parameters: { scope: 'corpus', ids: [interestedEvent.id] }, resultId: 'positive-source',
  });
  const positiveJudgment = await session.execute({
    commandId: 'judge-positive', command: 'remember', input: 'positive-source',
    parameters: {
      kind: 'judgment', judgment: 'interested', strength: 0.8,
      reason: 'Relevant first-hand example', attribution: 'researcher',
      sourceReferences: [{ type: 'event', id: interestedEvent.id }],
    },
  });
  assert.equal(positiveJudgment.ok, true);
  memory.ingest(uninterestedEvent, {
    relay: 'wss://fixture.example/', observedAt: '2026-07-27T10:01:00.000Z',
  });
  await session.execute({
    commandId: 'negative-source', command: 'select',
    parameters: { scope: 'corpus', ids: [uninterestedEvent.id] }, resultId: 'negative-source',
  });
  const negativeJudgment = await session.execute({
    commandId: 'judge-negative', command: 'remember', input: 'negative-source',
    parameters: {
      kind: 'judgment', judgment: 'uninterested',
      reason: 'Useful counterexample, outside this inquiry', attribution: 'researcher',
      sourceReferences: [{ type: 'event', id: uninterestedEvent.id }],
    },
  });
  assert.equal(negativeJudgment.ok, true);

  await session.execute({
    commandId: 'positives', command: 'notebook',
    parameters: { judgments: ['interested'] }, resultId: 'positives',
  });
  await session.execute({
    commandId: 'negatives', command: 'notebook',
    parameters: { judgments: ['uninterested'] }, resultId: 'negatives',
  });
  const constrained = await session.execute({
    commandId: 'constraint', command: 'difference', input: 'positives',
    parameters: { with: 'negatives', limit: 10 }, resultId: 'constrained',
  });
  assert.equal(constrained.result.handle.count, 1);
  assert.equal(
    memory.getNotebookEntry({ type: 'event', id: interestedEvent.id }).reason,
    'Relevant first-hand example',
  );

  const retained = await session.execute({
    commandId: 'retain', command: 'remember-membership', input: 'constrained',
    parameters: { name: 'provisional examples' }, resultId: 'retained-handle',
  });
  assert.deepEqual(retained.warnings, []);
  const membershipName = 'provisional examples';
  const membershipInput = await session.execute({
    commandId: 'membership-input', command: 'filter', input: 'retained-handle',
    parameters: { where: { field: 'subject.type', equals: 'event' }, limit: 10 },
    resultId: 'membership-input',
  });
  assert.equal(membershipInput.result.handle.count, 1);

  const turnoverEvents = [0, 1].map((index) => finalizeEvent({
    kind: 1,
    created_at: 200 + index,
    tags: [],
    content: `turnover ${index}`,
  }, NOTEBOOK_TEST_KEY));
  for (const event of turnoverEvents) {
    memory.ingest(event, {
      relay: 'wss://turnover.example/', observedAt: '2026-07-27T10:02:00.000Z',
    });
  }
  assert.equal(memory.inspect({ type: 'event', id: interestedEvent.id }).resolutionSource, 'unresolved');
  assert.equal(memory.inspect({ type: 'event', id: uninterestedEvent.id }).resolutionSource, 'unresolved');
  assert.equal(memory.describe().observationBuffer.evictions, 2);

  const notebookAfterTurnover = await session.execute({
    commandId: 'notebook-after-turnover', command: 'filter', input: 'positives',
    parameters: { where: { field: 'subject.type', equals: 'event' }, limit: 10 },
    resultId: 'notebook-after-turnover',
  });
  assert.equal(notebookAfterTurnover.result.handle.count, 1);
  const membershipAfterTurnover = await session.execute({
    commandId: 'membership-after-turnover', command: 'filter', input: 'retained-handle',
    parameters: { where: { field: 'subject.type', equals: 'event' }, limit: 10 },
    resultId: 'membership-after-turnover',
  });
  assert.equal(membershipAfterTurnover.result.handle.count, 1);
  const shownMembershipAfterTurnover = await session.execute({
    commandId: 'show-membership-after-turnover', command: 'show', input: 'retained-handle',
    parameters: { includeEvidence: true, previewLimit: 10 },
  });
  assert.equal(shownMembershipAfterTurnover.ok, true);
  assert.equal(shownMembershipAfterTurnover.result.type, 'result-collection');
  assert.equal(shownMembershipAfterTurnover.result.preview[0].resolved, false);

  const turnoverSelection = await session.execute({
    commandId: 'turnover-source', command: 'select',
    parameters: { scope: 'corpus', ids: [turnoverEvents[0].id] }, resultId: 'turnover-source',
  });
  const revisionBeforeSummaryPlan = turnoverSelection.sessionRevision;
  const validSummaryPlan = await session.execute({
    commandId: 'remember-summary-plan-valid',
    command: 'plan',
    plan: [{
      id: 'source',
      operation: 'select',
      parameters: { scope: 'corpus', ids: [turnoverEvents[0].id] },
    }, {
      id: 'summary',
      operation: 'remember',
      input: 'source',
      parameters: {
        kind: 'derived-observation',
        summary: { observation: 'explicit bounded example', count: 1 },
        reason: 'Remembered for later comparison',
        attribution: 'researcher',
        sourceReferences: [{ type: 'event', id: turnoverEvents[0].id }],
      },
    }],
  });
  assert.equal(validSummaryPlan.ok, true);
  assert.equal(validSummaryPlan.sessionRevision, revisionBeforeSummaryPlan + 1);
  assert.deepEqual(
    memory.getNotebookEntry({ type: 'event', id: turnoverEvents[0].id }).summary,
    { observation: 'explicit bounded example', count: 1 },
  );

  const replaced = await session.execute({
    commandId: 'replace', command: 'replace-membership', input: 'negatives',
    parameters: {
      name: membershipName,
      reason: { type: 'explicit-negative-example', provisional: true },
    },
  });
  assert.equal(replaced.result.memberCount, 1);
  assert.equal(memory.getMembership(membershipName).members[0].id, uninterestedEvent.id);

  const released = await session.execute({
    commandId: 'release', command: 'release', input: 'retained-handle', parameters: {},
  });
  assert.equal(released.result.type, 'released-result-handle');
  const inspectedSet = await session.execute({
    commandId: 'inspect-membership', command: 'membership', parameters: { name: membershipName },
  });
  assert.equal(inspectedSet.result.name, membershipName);

  const filteredNotebook = await session.execute({
    commandId: 'filter-notebook', command: 'filter', input: 'positives',
    parameters: { where: { field: 'subject.type', equals: 'event' }, limit: 2 },
    resultId: 'filtered-notebook',
  });
  assert.equal(filteredNotebook.result.handle.count, 1);

  assert.equal(memory.getNotebookEntry({ type: 'event', id: interestedEvent.id }).attribution, 'researcher');
  assert.equal(memory.archived().count, 0);
  assert.equal(memory.getMembership(membershipName).members.length, 1);

  await session.execute({
    commandId: 'delete', command: 'delete-membership', parameters: { name: membershipName },
  });
  assert.equal(memory.getNotebookEntry({ type: 'event', id: interestedEvent.id }).judgment, 'interested');

  await session.close();
});
