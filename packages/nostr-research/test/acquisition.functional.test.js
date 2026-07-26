import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acquireRelayEvents,
  createInMemoryResearchMemory,
  hydrateAccounts,
  ResearchMemoryError,
  subject,
} from '@nostr-research/memory';

test('acquisition rejects unusable public inputs before networking', async () => {
  const memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    await assert.rejects(
      acquireRelayEvents(memory, { relays: ['ws://localhost:1'], filter: {} }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(memory, { relays: ['wss://localhost:1'], filter: { nope: true } }),
      ResearchMemoryError,
    );
    await assert.rejects(
      acquireRelayEvents(memory, {
        relays: ['wss://localhost:1'], filter: {}, eventLimit: 1,
      }),
      /Unknown acquisition options: eventLimit/,
    );
    await assert.rejects(
      acquireRelayEvents(memory, {
        relays: ['wss://localhost:1'], filter: {}, distinctEventLmit: 1,
      }),
      /Unknown acquisition options: distinctEventLmit/,
    );
    const accounts = memory.collection([
      { subject: subject('account', 'a'.repeat(64)), reasons: [], provenance: [] },
    ], { operation: 'account-candidates' });
    await assert.rejects(
      hydrateAccounts(memory, accounts, {
        relays: ['wss://localhost:1'], kinds: [1],
      }),
      /kinds must contain only 0 and\/or 3/,
    );
    await assert.rejects(
      hydrateAccounts(memory, memory.collection([], { operation: 'empty' }), {
        relays: ['wss://localhost:1'],
      }),
      /at least one account subject/,
    );
  } finally {
    memory.close();
  }
});
