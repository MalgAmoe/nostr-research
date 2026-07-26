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
