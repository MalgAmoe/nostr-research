import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { openResearchMemory } from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));

test('large retention is atomic, bounded, durable, and remains directly navigable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-reliable-memory-'));
  const database = join(directory, 'memory.sqlite');
  let memory = openResearchMemory(database);
  try {
    const events = [];
    for (let index = 0; index < 1_050; index += 1) {
      const event = finalizeEvent({
        kind: 1,
        created_at: 1_700_000_000 + index,
        tags: index === 1 ? [['e', events[0].id, '', 'reply']] : [],
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
    const retained = memory.retain(selected, 'one thousand findings');
    assert.equal(retained.memberCount, 1_000);
    assert.equal(retained.reasonCount, 2_000);
    assert.ok(retained.preview.length <= 10);
    assert.equal('members' in retained, false);

    const setCount = memory.listSets().length;
    const interruptedCollection = memory.select({ ids: [events[0].id] });
    const cancellation = new AbortController();
    cancellation.abort();
    assert.throws(
      () => memory.retain(
        interruptedCollection, 'must roll back', { signal: cancellation.signal },
      ),
      /interrupted/,
    );
    assert.equal(memory.listSets().length, setCount);

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
      edge.sourceRef && edge.targetRef && !edge.sourceSummary && !edge.targetSummary
    )));
    assert.ok(Object.keys(compact.subjects).length <= traversed.items.length);

    memory.close();
    memory = openResearchMemory(database);
    assert.equal(memory.getSet(retained.id).members.length, 1_000);
  } finally {
    memory?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
