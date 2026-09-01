import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

const SUMMARY_TEST_KEY = Uint8Array.from(Buffer.from('6'.repeat(64), 'hex'));

test('summary size bounds retain the public factual core and report presentation omissions', async () => {
  const events = Array.from({ length: 40 }, (_, index) => finalizeEvent({
    kind: 1000 + index,
    created_at: 100 + index,
    tags: [],
    content: `bounded summary fixture ${index}`,
  }, SUMMARY_TEST_KEY));
  const memory = createInMemoryResearchMemory({ capacity: events.length });
  const session = createDeclarativeResearchSession(memory);
  for (const event of events) {
    memory.ingest(event, {
      relay: 'wss://fixture.example/',
      observedAt: '2026-07-26T10:00:00.000Z',
    });
  }
  await session.execute({
    commandId: 'select-many-kinds',
    command: 'select',
    parameters: { scope: 'corpus', limit: events.length },
    resultId: 'many-kinds',
  });

  const shown = await session.execute({
    commandId: 'show-bounded-summary',
    command: 'show',
    input: 'many-kinds',
    parameters: { mode: 'summary', sizeLimit: 1000 },
  });

  assert.equal(shown.ok, true);
  assert.ok(Buffer.byteLength(JSON.stringify(shown.result)) <= 1000);
  assert.equal(shown.result.summary.resultKind, 'result-collection');
  assert.equal(shown.result.summary.count, events.length);
  assert.equal(shown.result.summary.countUnit, 'subjects');
  assert.equal(shown.result.summary.lineage.operation, 'selection');
  assert.equal(shown.result.sizeBounded, true);
  assert.equal(shown.result.summary.presentationOmissions.reason, 'response-size');
  assert.ok(shown.result.summary.presentationOmissions.specializedFieldCount > 0);
  assert.deepEqual(shown.result.preview, []);
});

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
  assert.equal(shown.result.observation, 'preview');
  assert.equal('nextOperations' in shown.result, false);
  assert.equal(shown.sessionRevision, 1);

  const invalidProjection = await session.execute({
    commandId: 'show-too-many',
    command: 'show',
    input: 'finding',
    parameters: { previewLimit: 21 },
  });
  assert.equal(invalidProjection.ok, false);
  assert.equal(invalidProjection.error.code, 'INVALID_COMMAND');
  assert.match(invalidProjection.error.message, /previewLimit must be an integer from 1 to 20/);
  assert.equal(invalidProjection.sessionRevision, 1);
  const unknownProjection = await session.execute({
    commandId: 'invalid-projection-name', command: 'show', input: 'finding',
    parameters: { limit: 10 },
  });
  assert.equal(unknownProjection.ok, false);
  assert.match(
    unknownProjection.error.message,
    /Valid parameters: mode, offset, previewLimit, excerptLimit, includeEvidence, sizeLimit/u,
  );

  for (const mode of ['summary', 'coverage', 'details', 'explain']) {
    const observed = await session.execute({
      commandId: `show-${mode}`,
      command: 'show',
      input: 'finding',
      parameters: { mode, previewLimit: 1, excerptLimit: 40, sizeLimit: 1000 },
    });
    assert.equal(observed.ok, true);
    assert.equal(observed.result.observation, mode);
    assert.ok(Buffer.byteLength(JSON.stringify(observed.result)) <= 1000);
    if (mode === 'summary') {
      assert.equal(observed.result.summary.subjects, 1);
      assert.deepEqual({
        resultKind: observed.result.summary.resultKind,
        count: observed.result.summary.count,
        countUnit: observed.result.summary.countUnit,
        evidenceResolution: observed.result.summary.evidenceResolution,
      }, {
        resultKind: 'result-collection',
        count: 1,
        countUnit: 'subjects',
        evidenceResolution: { buffer: 1, archive: 0, unresolved: 0 },
      });
      assert.equal(observed.result.summary.eventFacts.distinctAuthorCount, 1);
    }
    if (mode === 'coverage') assert.equal(observed.result.coverage.evidenceResolution.buffer, 1);
    if (mode === 'details') {
      assert.ok(observed.result.preview[0], JSON.stringify(observed.result));
      assert.equal(observed.result.preview[0].evidence.event.id, event.id);
    }
    if (mode === 'explain') assert.equal(observed.result.preview[0].reasons.length, 1);
    assert.equal(observed.sessionRevision, 1);
  }

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

  const listed = await session.execute({
    commandId: 'list',
    command: 'list',
    parameters: { limit: 1 },
  });
  assert.equal(listed.result.count, 2);
  assert.equal(listed.result.omitted, 1);
  assert.equal(listed.sessionRevision, 2);

  const invalidList = await session.execute({
    commandId: 'list-with-offset',
    command: 'list',
    parameters: { offset: 0 },
  });
  assert.equal(invalidList.ok, false);
  assert.equal(invalidList.error.code, 'INVALID_COMMAND');
  assert.equal(invalidList.error.message, 'Unknown list parameter: offset.');
  assert.equal(invalidList.sessionRevision, 2);

  const released = await session.execute({
    commandId: 'release',
    command: 'release',
    input: 'chosen',
    parameters: {},
  });
  assert.equal(released.sessionRevision, 3);
  assert.equal(memory.getEvent(event.id).event.id, event.id);

  const status = await session.execute({
    commandId: 'status',
    command: 'status',
    parameters: {},
  });
  assert.equal(status.result.revision, 3);
  assert.equal(status.result.handleCount, 1);
  assert.equal('notebook' in status.result, false);
  assert.equal(status.sessionRevision, 3);

  const reset = await session.execute({
    commandId: 'reset',
    ifRevision: 3,
    command: 'reset',
    parameters: {},
  });
  assert.equal(reset.sessionRevision, 4);
  assert.equal(memory.describe().observationBuffer.eventCount, 0);

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

test('relation summaries compact source selection details without losing their shape', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 10 });
  const session = createDeclarativeResearchSession(memory);
  const [event] = loadFixtureEvents();
  memory.ingest(event, {
    relay: 'wss://fixture.example/',
    observedAt: '2026-07-26T10:00:00.000Z',
  });

  await session.execute({
    commandId: 'select',
    command: 'select',
    parameters: { scope: 'corpus', ids: [event.id] },
    resultId: 'finding',
  });
  await session.execute({
    commandId: 'relate',
    command: 'relate',
    input: 'finding',
    resultId: 'findingRows',
  });
  const shown = await session.execute({
    commandId: 'show-related',
    command: 'show',
    input: 'findingRows',
    parameters: { mode: 'summary' },
  });

  assert.deepEqual(shown.result.context, {
    operation: 'relate',
    sourceKind: 'events',
    source: {
      operation: 'selection',
      query: { idCount: 1, limit: 50, order: 'newest' },
    },
    cardinality: { inputCount: 1, outputCount: 1, truncated: false },
  });
  assert.equal(JSON.stringify(shown.result.context).includes(event.id), false);
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
  const leftSchema = await session.execute({
    commandId: 'left-schema', command: 'schema', input: 'left', parameters: {},
  });
  assert.equal(leftSchema.ok, true);
  assert.equal(leftSchema.result.compatibleOperations.includes('move'), true);
  assert.equal(leftSchema.result.compatibleOperations.includes('continue'), true);
  assert.equal(leftSchema.result.compatibleOperations.includes('preserve'), true);
  assert.equal('operations' in leftSchema.result, false);
  const moveSchema = await session.execute({
    commandId: 'left-move-schema', command: 'schema', input: 'left',
    parameters: { operation: 'move' },
  });
  assert.deepEqual(moveSchema.result.operation.choices.to, [
    { to: 'authors', outputKind: 'accounts' },
    { to: 'referencedAccounts', outputKind: 'accounts' },
    { to: 'referencedEvents', outputKind: 'events' },
    { to: 'referencedAddresses', outputKind: 'addresses' },
  ]);
  const unionSchema = await session.execute({
    commandId: 'left-union-schema', command: 'schema', input: 'left',
    parameters: { operation: 'union' },
  });
  assert.equal(unionSchema.result.operation.remainingChoices.length, 1);
  const continueSchema = await session.execute({
    commandId: 'left-continue-schema', command: 'schema', input: 'left',
    parameters: { operation: 'continue' },
  });
  assert.equal(
    continueSchema.result.operation.choices.relationships.some(
      ({ relationship }) => relationship === 'replies',
    ),
    true,
  );
  const compared = await session.execute({
    commandId: 'compare', command: 'compare', input: 'left',
    parameters: { with: 'right' }, resultId: 'comparison',
  });
  assert.equal(compared.ok, true);
  assert.equal(compared.result.handle.kind, 'summaries');
  const comparisonSchema = await session.execute({
    commandId: 'comparison-schema', command: 'schema',
    input: 'comparison', parameters: {},
  });
  assert.equal(comparisonSchema.ok, true);
  assert.equal(comparisonSchema.result.structure.kind, 'summaries');
  assert.equal(comparisonSchema.result.structure.count, 1);
  assert.deepEqual(comparisonSchema.result.structure.subjectTypes, []);
  assert.deepEqual(comparisonSchema.result.compatibleOperations, []);
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
  for (const mode of ['summary', 'coverage', 'details', 'explain']) {
    const observed = await session.execute({
      commandId: `show-comparison-${mode}`,
      command: 'show',
      input: 'comparison',
      parameters: { mode, previewLimit: 1, sizeLimit: 2000 },
    });
    assert.equal(observed.result.observation, mode);
    if (mode === 'summary') {
      assert.equal(observed.result.summary.items, 1);
      assert.equal(observed.result.summary.resultKind, 'typed-collection');
      assert.equal(observed.result.summary.countUnit, 'rows');
    }
    if (mode === 'coverage') {
      assert.equal(observed.result.coverage.bounds.outputCount, 1);
      assert.equal(observed.result.coverage.partial, false);
    }
    if (mode === 'details') assert.equal(observed.result.preview[0].evidence.available, false);
    if (mode === 'explain') assert.equal(observed.result.preview[0].reasons.length > 0, true);
  }
  await session.execute({
    commandId: 'left-rows', command: 'relate', input: 'left',
    parameters: {}, resultId: 'left-rows',
  });
  const relationDetails = await session.execute({
    commandId: 'left-row-details', command: 'show', input: 'left-rows',
    parameters: {
      mode: 'details', previewLimit: 1, excerptLimit: 40, sizeLimit: 1000,
    },
  });
  assert.equal(relationDetails.result.observation, 'details');
  assert.equal(
    relationDetails.result.preview[0].subjects[0].evidence.event.id,
    event.id,
  );
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
    commandId: 'schema', command: 'schema', parameters: { detail: 'full' },
  });
  assert.equal(schema.ok, true);
  assert.ok(schema.result.operations.set.operations.includes('difference'));
  assert.deepEqual(
    schema.result.research.parameterContracts.scan.matchMode.values,
    ['substring', 'word', 'phrase'],
  );
  assert.equal(
    schema.result.research.parameterContracts.select.filter,
    undefined,
  );
  assert.equal('kinds' in schema.result.research.parameterContracts.select, true);
  assert.equal('where' in schema.result.research.parameterContracts.filter, true);
  assert.equal(
    schema.result.session.commands.observation.show.parameters.offset,
    'non-negative integer',
  );
  assert.equal(schema.result.constraints.presentation.previewLimit.maximum, 20);
  assert.equal(schema.result.session.configuration.effective.presentation.previewLimit, 5);
  assert.equal(schema.sessionRevision, 6);

  const configured = await session.execute({
    commandId: 'configure',
    command: 'configure',
    parameters: {
      relays: ['wss://fixture.example'],
      acquisition: { timeoutMs: 2500, concurrency: 2 },
      presentation: { previewLimit: 2, excerptLimit: 80 },
    },
  });
  assert.equal(configured.ok, true);
  assert.equal(configured.sessionRevision, 7);
  assert.equal(configured.result.configuration.presentation.sizeLimit, 12000);
  assert.deepEqual(configured.result.configuration.relays, ['wss://fixture.example/']);

  for (const [suffix, acquisition] of [
    ['timeout', { timeoutMs: 60001 }],
    ['concurrency', { concurrency: 11 }],
  ]) {
    const rejected = await session.execute({
      commandId: `configure-${suffix}`,
      command: 'configure',
      parameters: { acquisition },
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, 'INVALID_COMMAND');
  }

  for (const [suffix, relay] of [
    ['credentials', 'wss://user:secret@fixture.example/'],
    ['fragment', 'wss://fixture.example/#research'],
  ]) {
    const rejected = await session.execute({
      commandId: `configure-${suffix}`,
      command: 'configure',
      parameters: { relays: [relay] },
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, 'INVALID_COMMAND');
    assert.deepEqual(
      (await session.execute({
        commandId: `status-after-${suffix}`, command: 'status', parameters: {},
      })).result.configuration.relays,
      ['wss://fixture.example/'],
    );
  }

  const configuredAgain = await session.execute({
    commandId: 'configure-again',
    command: 'configure',
    parameters: {
      relays: ['wss://fixture.example/'],
      acquisition: { timeoutMs: 2500, concurrency: 2 },
      presentation: { previewLimit: 2, excerptLimit: 80 },
    },
  });
  assert.equal(configuredAgain.sessionRevision, 7);
  const configuredStatus = await session.execute({
    commandId: 'configured-status', command: 'status', parameters: {},
  });
  assert.equal(configuredStatus.result.configuration.acquisition.timeoutMs, 2500);
  assert.equal(configuredStatus.result.configuration.presentation.previewLimit, 2);
  await session.close();
});
