import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
  createResearchSession,
  subject,
} from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('6'.repeat(64), 'hex'));

test('public session actions remain temporary while checkpoints remain process-local', () => {
  const root = finalizeEvent({
    kind: 1, created_at: 10, tags: [], content: 'root',
  }, SECRET);
  const reply = finalizeEvent({
    kind: 1, created_at: 11, tags: [['e', root.id, '', 'reply']], content: 'reply',
  }, SECRET);
  let memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    for (const event of [root, reply]) {
      memory.ingest(event, {
        relay: 'wss://fixture.example/', observedAt: '2026-01-01T00:00:00.000Z',
      });
    }
    const session = createResearchSession(memory, memory.select({ ids: [root.id] }));
    session.setFocus(subject('event', root.id));
    session.include(subject('event', reply.id));
    session.branch('both');
    session.exclude(subject('event', root.id));
    assert.equal(session.selection.items.length, 1);
    assert.deepEqual(session.focus, subject('event', root.id));
    session.returnToBranch('both');
    assert.equal(session.selection.items.length, 2);
    session.traverse({
      relationshipTypes: ['reply-parent'], direction: 'inbound', depth: 1, limit: 10,
    });
    assert.equal(session.currentAction.type, 'traverse');
    assert.equal(session.view('subject-list', { mode: 'ids' }).length, 2);
    assert.equal(session.view('account-list', { mode: 'ids' }).length, 1);
    const checkpoint = session.checkpoint('temporary findings');
    assert.equal(memory.getSet(checkpoint.id).members.length, 2);

    session.exclude(subject('event', reply.id));
    assert.equal(memory.getSet(checkpoint.id).members.length, 2);
    assert.ok(memory.getEvent(root.id));

    const continued = createResearchSession(memory, checkpoint);
    assert.equal(continued.selection.items.length, 2);
    continued.setFocus(subject('event', reply.id));
    assert.equal(continued.focus.id, reply.id);

    const returnedSet = memory.getSet(checkpoint.id);
    assert.equal(createResearchSession(memory, returnedSet).selection.items.length, 2);

    const emptySet = memory.createSet('empty starting point');
    assert.equal(createResearchSession(memory, emptySet).selection.items.length, 0);
  } finally {
    memory?.close();
  }
});

test('sessions start from public runs returned by recordRun and getRun', () => {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    const event = finalizeEvent({
      kind: 1, created_at: 12, tags: [], content: 'recorded result',
    }, SECRET);
    const observation = {
      relay: 'wss://fixture.example/', observedAt: '2026-01-01T00:00:00.000Z',
    };
    memory.ingest(event, observation);
    const outcome = memory.searchEvents({ ids: [event.id] });
    const recorded = memory.recordRun({
      operation: 'event-query',
      inputs: outcome.query,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
      status: 'completed',
      diagnostics: [],
      results: [{
        type: 'event',
        id: event.id,
        reasons: outcome.results[0].matchReasons,
        provenance: [observation],
      }],
    });

    const fromRecorded = createResearchSession(memory, recorded);
    assert.deepEqual(fromRecorded.selection.items[0].subject, subject('event', event.id));
    assert.deepEqual(fromRecorded.selection.items[0].reasons, recorded.results[0].reasons);
    assert.deepEqual(fromRecorded.selection.items[0].provenance, recorded.results[0].provenance);
    assert.equal(fromRecorded.selection.context.runId, recorded.id);

    const loaded = memory.getRun(recorded.id);
    const fromLoaded = createResearchSession(memory, loaded);
    assert.deepEqual(fromLoaded.selection, fromRecorded.selection);
  } finally {
    memory.close();
  }
});

test('bounded attempt coverage distinguishes exact attempted slices from uncertainty', () => {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    const event = finalizeEvent({
      kind: 1, created_at: 15, tags: [], content: 'covered',
    }, SECRET);
    const ingested = memory.ingest(event, {
      relay: 'wss://one.example/', observedAt: '2026-01-01T00:00:00.000Z',
    });
    const slices = [
      { relays: ['wss://one.example/'], filter: { kinds: [1], since: 0, until: 9 } },
      { relays: ['wss://one.example/'], filter: { kinds: [1], since: 10, until: 19 } },
    ];
    for (const [index, slice] of slices.entries()) {
      memory.recordAcquisitionCoverage({
        requested: { relays: slice.relays, filter: slice.filter },
        budget: {
          timeoutMs: 1000, observationLimit: 10, distinctEventLimit: 10, concurrency: 1,
        },
        startedAt: `2026-01-01T00:00:0${index}.000Z`,
        finishedAt: `2026-01-01T00:00:0${index + 1}.000Z`,
        completionReason: 'completed',
        relays: [{
          relay: 'wss://one.example/', contacted: true, outcome: 'eose', received: index === 1 ? 1 : 0,
          invalid: 0, duplicate: 0, newlyStored: index === 1 ? 1 : 0,
          observations: index === 1 ? 1 : 0, diagnostic: null,
        }],
        acquiredObservations: index === 1
          ? [{ eventId: event.id, observations: [ingested.observation] }] : [],
      });
    }
    assert.equal(memory.acquisitionCoverage({
      relays: slices[0].relays, filter: slices[0].filter,
    }).attempted, true);
    assert.equal(memory.acquisitionCoverage({
      relays: ['wss://one.example/'], filter: { kinds: [1], since: 20, until: 29 },
    }).attempted, false);
    assert.equal(memory.listAcquisitionCoverage()[1].observedEvents[0].eventId, event.id);
    assert.equal(memory.listAcquisitionCoverage()[0].exhaustive, false);
  } finally {
    memory.close();
  }
});
