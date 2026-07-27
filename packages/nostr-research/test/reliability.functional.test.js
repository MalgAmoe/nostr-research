import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { createInMemoryResearchMemory } from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));

test('large notebook membership is atomic, bounded, process-local, and directly navigable', () => {
  let memory = createInMemoryResearchMemory({ capacity: 1000 });
  try {
    const events = [];
    for (let index = 0; index < 1_050; index += 1) {
      const event = finalizeEvent({
        kind: 1,
        created_at: 1_700_000_000 + index,
        tags: index === 51 ? [['e', events[50].id, '', 'reply']] : [],
        content: `bounded corpus event ${index}`,
      }, SECRET);
      events.push(event);
      memory.ingest(event, {
        relay: `wss://relay-${index % 3}.example`,
        observedAt: '2026-07-25T12:00:00.000Z',
      });
    }

    const selected = memory.select({ kinds: [1], order: 'oldest', limit: 1_000 });
    for (const item of selected.items) {
      item.reasons.push({ type: 'corpus-membership', corpus: 'reliability' });
    }
    const retained = memory.rememberMembership(selected, 'one thousand findings');
    assert.equal(retained.memberCount, 1_000);
    assert.equal(retained.reasonCount, 2_000);
    assert.ok(retained.preview.length <= 10);
    assert.equal('members' in retained, false);

    const setCount = memory.listMemberships().length;
    const interruptedCollection = memory.collection([selected.items[0]]);
    const cancellation = new AbortController();
    cancellation.abort();
    assert.throws(
      () => memory.rememberMembership(
        interruptedCollection, 'must roll back', { signal: cancellation.signal },
      ),
      /interrupted/,
    );
    assert.equal(memory.listMemberships().length, setCount);

    const traversed = memory.traverse([selected.items[0].subject], {
      relationshipTypes: ['reply-parent'],
      direction: 'inbound',
      depth: 1,
      limit: 10,
    });
    assert.equal(traversed.items[0].role, 'seed');
    assert.ok(traversed.items.some((item) => item.role === 'discovery'));
    const compact = memory.project(traversed, { mode: 'compact', previewLimit: 2 });
    assert.ok(compact.relationships.every((edge) => (
      edge.source && edge.target && !edge.sourceSummary && !edge.targetSummary
    )));
    assert.ok(compact.results.length <= traversed.items.length);

    assert.equal(memory.getMembership(retained.id).members.length, 1_000);
  } finally {
    memory?.close();
  }
});
