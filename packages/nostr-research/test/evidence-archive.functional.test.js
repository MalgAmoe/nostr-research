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
    await command(session, 'preserve-reference', 'preserve', {
      input: 'reference',
      parameters: { level: 'reference', reason: { type: 'identity-only' } },
    });

    const beforeFailure = structuredClone(memory.describe());
    const archiveBeforeFailure = structuredClone(memory.archived());
    assert.throws(() => memory.preserve(memory.collection([{
      subject: subject('event', events[3].id),
    }]), {
      level: 'reference',
      reason: { type: 'over-capacity' },
    }), ResearchMemoryError);
    assert.deepEqual(memory.describe(), beforeFailure);
    assert.deepEqual(memory.archived(), archiveBeforeFailure);
    assert.throws(() => memory.preserve(memory.collection([{
      subject: subject('event', events[5].id),
    }]), {
      level: 'excerpt',
      reason: { type: 'invalid-unresolved-excerpt' },
    }), ResearchMemoryError);
    assert.deepEqual(memory.describe(), beforeFailure);
    assert.deepEqual(memory.archived(), archiveBeforeFailure);

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
