import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  ResearchMemoryError,
  subject,
} from '@nostr-research/memory';

const KEY = Uint8Array.from(Buffer.from('9'.repeat(64), 'hex'));
const observation = {
  relay: 'wss://archive-fixture.example',
  observedAt: '2026-07-27T10:00:00.000Z',
};

test('canonical archive aliases merge observations while buffer residency stays independent', () => {
  const memory = createInMemoryResearchMemory({ capacity: 2, archiveCapacity: 2 });
  const event = finalizeEvent({
    kind: 30000,
    created_at: 90,
    tags: [['d', 'topic']],
    content: 'addressable evidence',
  }, KEY);
  const coordinate = `30000:${event.pubkey}:topic`;
  const first = { ...observation, relay: 'wss://first.example/' };
  const second = {
    ...observation,
    relay: 'wss://second.example/',
    observedAt: '2026-07-27T10:01:00.000Z',
  };

  memory.ingest(event, first);
  memory.preserve(memory.lookup(subject('event', event.id)), {
    level: 'canonical', reason: { type: 'event-alias' },
  });
  memory.ingest(event, second);
  memory.preserve(memory.lookup(subject('address', coordinate)), {
    level: 'canonical', reason: { type: 'address-alias' },
  });

  const inspected = memory.inspect(subject('event', event.id));
  assert.equal(inspected.resident, true);
  assert.equal(inspected.resolutionSource, 'archive');
  assert.deepEqual(
    inspected.evidence.observations.map(({ relay }) => relay).sort(),
    ['wss://first.example/', 'wss://second.example/'],
  );
});

test('explicit archive preservation survives complete buffer turnover and releases atomically', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 2, archiveCapacity: 3 });
  const session = createDeclarativeResearchSession(memory);
  const events = Array.from({ length: 6 }, (_, index) => sign(
    [0, 3].includes(index) ? 0 : 1,
    100 + index,
    index === 0 ? JSON.stringify({ name: 'archived profile' })
      : index === 3 ? JSON.stringify({ name: 'newer buffered profile' })
        : `note ${index}`,
  ));
  try {
    const unknownMembership = await session.execute({
      commandId: 'unknown-membership',
      command: 'membership',
      parameters: { name: 'missing' },
    });
    assert.equal(unknownMembership.ok, false);
    assert.equal(unknownMembership.error.code, 'UNKNOWN_MEMBERSHIP');

    memory.ingest(events[0], observation);
    memory.ingest(events[1], observation);

    await command(session, 'select-profile', 'select', {
      parameters: { scope: 'corpus', ids: [events[0].id] },
      resultId: 'profile',
    });
    const canonical = await command(session, 'preserve-profile', 'preserve', {
      input: 'profile',
      parameters: { level: 'canonical', reason: { type: 'research-anchor' } },
      resultId: 'preserved-profile',
    });
    assert.equal(canonical.sessionRevision, 2);
    assert.equal(canonical.result.handle.kind, 'events');

    const empty = await command(session, 'select-empty', 'select', {
      parameters: { scope: 'corpus', ids: [events[5].id] },
      resultId: 'empty',
    });
    const revisionBeforeEmptyPreserve = empty.sessionRevision;
    const emptyPreservation = await command(session, 'preserve-empty', 'preserve', {
      input: 'empty',
      parameters: { level: 'reference', reason: { type: 'empty-selection' } },
    });
    assert.equal(emptyPreservation.sessionRevision, revisionBeforeEmptyPreserve);

    const emptyPlan = await session.execute({
      commandId: 'empty-preservation-plan',
      command: 'plan',
      plan: [
        {
          id: 'missing',
          operation: 'select',
          parameters: { scope: 'corpus', ids: [events[5].id] },
        },
        {
          id: 'preserved',
          operation: 'preserve',
          input: 'missing',
          parameters: { level: 'reference', reason: { type: 'empty-plan-selection' } },
        },
      ],
      outputs: {},
    });
    assert.equal(emptyPlan.ok, true);
    assert.equal(emptyPlan.result.stages[1].resultKind, 'events');
    assert.equal(emptyPlan.sessionRevision, revisionBeforeEmptyPreserve);

    const excerptPlan = await session.execute({
      commandId: 'excerpt-plan',
      command: 'plan',
      plan: [
        {
          id: 'note',
          operation: 'select',
          parameters: { scope: 'corpus', ids: [events[1].id] },
        },
        {
          id: 'excerpt',
          operation: 'preserve',
          input: 'note',
          parameters: {
            level: 'excerpt',
            excerptLimit: 12,
            reason: { type: 'bounded-quotation' },
          },
        },
      ],
      outputs: { note: 'note' },
    });
    assert.equal(excerptPlan.ok, true);
    assert.equal(excerptPlan.sessionRevision, revisionBeforeEmptyPreserve + 1);
    assert.equal(excerptPlan.result.stages[1].resultKind, 'events');

    memory.ingest(events[2], observation);
    await command(session, 'select-reference', 'select', {
      parameters: { scope: 'corpus', ids: [events[2].id] },
      resultId: 'reference',
    });
    await command(session, 'reference-author', 'move', {
      input: 'reference',
      parameters: { to: 'authors' },
      resultId: 'reference-author',
    });

    const beforeFailure = structuredClone(memory.describe());
    const archiveBeforeFailure = structuredClone(memory.archived());
    const revisionBeforeFailedPlan = session.revision;
    const failedPlan = await session.execute({
      commandId: 'runtime-failure-plan',
      command: 'plan',
      plan: [
        {
          id: 'new-event',
          operation: 'select',
          parameters: { scope: 'corpus', ids: [events[2].id] },
        },
        {
          id: 'preserve-event',
          operation: 'preserve',
          input: 'new-event',
          parameters: { level: 'reference', reason: { type: 'must-roll-back' } },
        },
        {
          id: 'author',
          operation: 'move',
          input: 'new-event',
          parameters: { to: 'authors' },
        },
        {
          id: 'fail-at-runtime',
          operation: 'preserve',
          input: 'author',
          parameters: { level: 'reference', reason: { type: 'over-capacity' } },
        },
      ],
      outputs: { 'preserve-event': 'must-not-install' },
    });
    assert.equal(failedPlan.ok, false);
    assert.equal(failedPlan.sessionRevision, revisionBeforeFailedPlan);
    assert.deepEqual(memory.describe(), beforeFailure);
    assert.deepEqual(memory.archived(), archiveBeforeFailure);
    assert.equal((await command(session, 'handles-after-failure', 'list', {
      parameters: { limit: 20 },
    })).result.preview.some(({ id }) => id === 'must-not-install'), false);

    await command(session, 'preserve-reference', 'preserve', {
      input: 'reference',
      parameters: { level: 'reference', reason: { type: 'identity-only' } },
    });
    const fullArchiveState = structuredClone(memory.describe());
    const fullArchiveEntries = structuredClone(memory.archived());
    const capacityFailure = await session.execute({
      commandId: 'preserve-over-capacity',
      command: 'preserve',
      input: 'reference-author',
      parameters: {
        level: 'reference',
        reason: { type: 'over-capacity' },
      },
    });
    assert.equal(capacityFailure.ok, false);
    assert.equal(capacityFailure.error.code, 'CAPACITY_EXCEEDED');

    assert.throws(() => memory.preserve(memory.collection([{
      subject: subject('event', events[3].id),
    }]), {
      level: 'reference',
      reason: { type: 'over-capacity' },
    }), ResearchMemoryError);
    assert.deepEqual(memory.describe(), fullArchiveState);
    assert.deepEqual(memory.archived(), fullArchiveEntries);
    assert.throws(() => memory.preserve(memory.collection([{
      subject: subject('event', events[5].id),
    }]), {
      level: 'excerpt',
      reason: { type: 'invalid-unresolved-excerpt' },
    }), ResearchMemoryError);
    assert.deepEqual(memory.describe(), fullArchiveState);
    assert.deepEqual(memory.archived(), fullArchiveEntries);

    memory.ingest(events[3], observation);
    memory.ingest(events[4], observation);
    assert.equal(memory.inspect(subject('account', events[0].pubkey)).resolutionSource, 'buffer');
    assert.equal(memory.currentEvent(events[0].pubkey, 0).event.id, events[3].id);
    memory.ingest(events[5], observation);
    assert.equal(memory.inspect(subject('event', events[0].id)).resolutionSource, 'archive');
    assert.equal(memory.inspect(subject('event', events[0].id)).resolved, true);
    assert.equal(memory.inspect(subject('account', events[0].pubkey)).resolutionSource, 'archive');
    assert.equal(memory.currentEvent(events[0].pubkey, 0).event.id, events[0].id);
    assert.equal(memory.inspect(subject('event', events[1].id)).resolutionSource, 'unresolved');
    assert.equal(memory.inspect(subject('event', events[2].id)).resolutionSource, 'unresolved');
    const unresolvedPreservation = await session.execute({
      commandId: 'preserve-unresolved',
      command: 'preserve',
      input: 'reference',
      parameters: {
        level: 'excerpt',
        reason: { type: 'unresolved-after-turnover' },
      },
    });
    assert.equal(unresolvedPreservation.ok, false);
    assert.equal(unresolvedPreservation.error.code, 'UNRESOLVED_EVIDENCE');

    const archive = memory.archived();
    assert.deepEqual(archive.entries.map(({ level }) => level).sort(), [
      'canonical', 'excerpt', 'reference',
    ]);
    const excerptEntry = archive.entries.find(({ level }) => level === 'excerpt');
    assert.ok(excerptEntry.excerpt);
    assert.equal('canonical' in excerptEntry, false);
    const archivedProfile = await command(session, 'inspect-archive', 'archived', {
      parameters: { subject: subject('event', events[0].id) },
      resultId: 'archived-profile',
    });
    assert.equal(archivedProfile.result.handle.count, 1);
    const archiveSummary = await command(session, 'show-archive-summary', 'show', {
      input: 'archived-profile',
      parameters: { mode: 'summary' },
    });
    assert.deepEqual(archiveSummary.result.summary.archiveEntries, {
      total: 1,
      byLevel: [{ level: 'canonical', count: 1 }],
    });
    assert.deepEqual(archiveSummary.result.summary.canonicalEvidenceResolution, {
      buffer: 0, archive: 1, unresolved: 0,
    });
    assert.deepEqual(archiveSummary.result.summary.evidenceResolution, {
      buffer: 0, archive: 1, unresolved: 0,
    });
    await command(session, 'release-archive-handle', 'release', {
      input: 'archived-profile',
      parameters: {},
    });
    assert.equal(memory.inspect(subject('event', events[0].id)).resolutionSource, 'archive');

    const revisionBeforeEvidenceRelease = session.revision;
    const released = await command(session, 'release-profile-evidence', 'release-archive', {
      input: 'profile',
      parameters: {},
    });
    assert.equal(released.ok, true);
    assert.equal(released.sessionRevision, revisionBeforeEvidenceRelease + 1);
    assert.equal(memory.inspect(subject('event', events[0].id)).resolutionSource, 'unresolved');
    assert.ok(memory.archived().entries.every(
      ({ subject: item }) => item.id !== events[0].id,
    ));

    const schema = await command(session, 'schema', 'schema', { parameters: {} });
    assert.ok(schema.result.research.operations.includes('preserve'));
    assert.ok(schema.result.research.operations.includes('archived'));
    assert.ok(schema.result.research.operations.includes('release-archive'));

    await command(session, 'reset', 'reset', { parameters: {} });
    assert.equal(memory.describe().archive.entryCount, 0);
    assert.equal(memory.describe().observationBuffer.eventCount, 0);
  } finally {
    await session.close();
  }
});

function sign(kind, createdAt, content) {
  return finalizeEvent({ kind, created_at: createdAt, tags: [], content }, KEY);
}

async function command(session, commandId, name, fields) {
  const result = await session.execute({ commandId, command: name, ...fields });
  assert.equal(result.ok, true, result.error?.message);
  return result;
}
