import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInMemoryResearchMemory,
  InvalidNostrEventError,
  loadFixtureEvents,
} from '@nostr-research/memory';

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
    assert.deepEqual(memory.summary(), { events: 1, observations: 2 });
    assert.deepEqual(memory.getEvent(event.id), {
      event,
      observations: [
        { id: first.observation.id, relay: 'wss://first.example', observedAt: '2024-01-01T00:00:00.000Z' },
        { id: second.observation.id, relay: 'wss://second.example', observedAt: '2024-01-02T00:00:00.000Z' },
      ],
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
    assert.deepEqual(memory.summary(), { events: 1, observations: 2 });

    memory.reset();
    assert.deepEqual(memory.summary(), { events: 0, observations: 0 });
    memory.importFixtures({ relay: 'wss://fixture-import.example', observedAt: '2024-01-03T00:00:00Z' });
    assert.deepEqual(memory.summary(), { events: 2, observations: 2 });
  } finally {
    memory.close();
  }
});
