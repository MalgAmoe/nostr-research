import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
  InvalidNostrEventError,
  isCanonicalNostrEvent,
} from '@nostr-research/memory';
import { loadFixtureEvents } from '../test-support/fixtures.js';

test('process-local memory preserves canonical evidence and independent relay observations', () => {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  const [event] = loadFixtureEvents();

  try {
    const first = memory.ingest(event, {
      relay: 'wss://first.example',
      observedAt: '2024-01-01T00:00:00.000Z',
    });
    const second = memory.ingest(event, {
      relay: 'wss://second.example',
      observedAt: '2024-01-02T00:00:00.000Z',
    });

    assert.equal(first.eventStored, true);
    assert.equal(second.eventStored, false);
    assert.equal(memory.describe().observationBuffer.eventCount, 1);
    assert.deepEqual(memory.getEvent(event.id), {
      event,
      observations: [
        { id: first.observation.id, relay: 'wss://first.example', observedAt: '2024-01-01T00:00:00.000Z' },
        { id: second.observation.id, relay: 'wss://second.example', observedAt: '2024-01-02T00:00:00.000Z' },
      ],
      omittedObservationCount: 0,
    });

    assert.throws(
      () => memory.ingest({ ...event, id: '0'.repeat(64) }, { relay: 'wss://invalid.example' }),
      InvalidNostrEventError,
    );
    assert.throws(
      () => memory.ingest({ ...event, sig: '0'.repeat(128) }, { relay: 'wss://invalid.example' }),
      InvalidNostrEventError,
    );
    assert.throws(
      () => memory.ingest({ ...event, tags: [['t', 42]] }, { relay: 'wss://invalid.example' }),
      InvalidNostrEventError,
    );
    assert.equal(memory.describe().observationBuffer.eventCount, 1);

    memory.reset();
    assert.equal(memory.describe().observationBuffer.eventCount, 0);
    for (const fixtureEvent of loadFixtureEvents()) {
      memory.ingest(fixtureEvent, {
        relay: 'wss://fixture-import.example',
        observedAt: '2024-01-03T00:00:00Z',
      });
    }
    assert.equal(memory.describe().observationBuffer.eventCount, 2);
  } finally {
    memory.close();
  }
});

test('memory bounds retained event provenance and preserves visible omissions in collection views and canonical archives', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 1, archiveCapacity: 1 });
  const session = createDeclarativeResearchSession(memory);
  const [event] = loadFixtureEvents();
  try {
    const identical = {
      relay: 'wss://same.example',
      observedAt: '2026-07-29T00:00:00.000Z',
    };
    const first = memory.ingest(event, identical);
    assert.equal(memory.ingest(event, identical).observation.id, first.observation.id);
    for (let index = 1; index < 103; index += 1) {
      memory.ingest(event, {
        relay: 'wss://same.example',
        observedAt: new Date(Date.UTC(2026, 6, 29, 0, 0, index)).toISOString(),
      });
    }

    const buffered = memory.getEvent(event.id);
    assert.equal(buffered.observations.length, 100);
    assert.equal(buffered.omittedObservationCount, 3);
    const repeatedOmitted = {
      relay: 'wss://same.example',
      observedAt: new Date(Date.UTC(2026, 6, 29, 0, 0, 102)).toISOString(),
    };
    memory.ingest(event, repeatedOmitted);
    // Once retention is full, this is deliberately a discarded-attempt count:
    // exact deduplication of omitted facts would require another unbounded store.
    assert.equal(memory.getEvent(event.id).omittedObservationCount, 4);
    assert.equal(memory.describe().observationBuffer.retainedObservationCount, 100);
    assert.equal(memory.describe().observationBuffer.omittedObservationCount, 4);

    const selected = memory.select({ ids: [event.id] });
    assert.equal(selected.items[0].record.omittedObservationCount, 4);
    await session.execute({
      commandId: 'bounded-selection',
      command: 'select',
      parameters: { scope: 'corpus', ids: [event.id] },
      resultId: 'bounded-event',
    });
    const preview = await session.execute({
      commandId: 'bounded-preview',
      command: 'show',
      input: 'bounded-event',
      parameters: { includeEvidence: true },
    });
    assert.equal(preview.result.preview[0].evidence.omittedObservationCount, 4);
    const coverage = await session.execute({
      commandId: 'bounded-coverage',
      command: 'show',
      input: 'bounded-event',
      parameters: { mode: 'coverage' },
    });
    assert.equal(coverage.result.coverage.sources.omittedObservationCount, 4);

    memory.preserve(memory.lookup({ type: 'event', id: event.id }), {
      level: 'canonical',
      reason: { type: 'bounded-provenance-regression' },
    });
    const archived = memory.archived().entries[0].canonical;
    assert.equal(archived.observations.length, 100);
    assert.equal(archived.omittedObservationCount, 4);
    assert.equal(memory.inspect({ type: 'event', id: event.id })
      .evidence.omittedObservationCount, 4);
  } finally {
    memory.close();
  }
});

test('canonical account preservation retains bounded provenance omissions', () => {
  const memory = createInMemoryResearchMemory({ capacity: 1, archiveCapacity: 1 });
  const key = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
  const metadata = finalizeEvent({
    kind: 0,
    created_at: 1,
    tags: [],
    content: '{"name":"bounded account"}',
  }, key);
  try {
    for (let index = 0; index < 103; index += 1) {
      memory.ingest(metadata, {
        relay: 'wss://account.example',
        observedAt: new Date(Date.UTC(2026, 6, 29, 0, 0, index)).toISOString(),
      });
    }
    memory.preserve(memory.lookup({ type: 'account', id: metadata.pubkey }), {
      level: 'canonical',
      reason: { type: 'account-provenance-regression' },
    });
    const canonical = memory.archived().entries[0].canonical;
    assert.equal(canonical.observations.length, 100);
    assert.equal(canonical.omittedObservationCount, 3);
    const resolvedAccount = memory.asCollection(memory.collection([{
      subject: { type: 'account', id: metadata.pubkey },
      reasons: [{ type: 'account-provenance-regression' }],
    }], { operation: 'account-provenance-regression' }, 'accounts'));
    assert.equal(resolvedAccount.items[0].record.omittedObservationCount, 3);
    assert.equal(memory.inspect({ type: 'account', id: metadata.pubkey })
      .evidence.omittedObservationCount, 3);
  } finally {
    memory.close();
  }
});

test('protocol rejects a canonical-looking event carrying another event signature', () => {
  const [event, other] = loadFixtureEvents();
  const wrongSignature = { ...event, sig: other.sig };
  assert.equal(wrongSignature.sig.length, 128);
  assert.equal(isCanonicalNostrEvent(wrongSignature), false);
});
