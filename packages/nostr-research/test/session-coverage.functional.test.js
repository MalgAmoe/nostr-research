import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createInMemoryResearchMemory,
  createResearchSession,
} from '@nostr-research/memory';

const SECRET = Uint8Array.from(Buffer.from('6'.repeat(64), 'hex'));

test('a session only changes active selection explicitly and checkpoints it process-locally', () => {
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
    const queried = memory.select({ ids: [reply.id] });
    assert.equal(session.selection.items.length, 1);
    assert.equal(session.selection.items[0].subject.id, root.id);

    session.activate(memory.select({ order: 'oldest' }));
    assert.equal(session.selection.items.length, 2);
    assert.equal(session.currentAction.type, 'activate');
    const checkpoint = session.checkpoint('temporary findings');
    assert.equal(memory.getSet(checkpoint.id).members.length, 2);

    session.activate(queried);
    assert.equal(session.selection.items.length, 1);
    assert.equal(memory.getSet(checkpoint.id).members.length, 2);
    assert.ok(memory.getEvent(root.id));

    const continued = createResearchSession(memory, checkpoint);
    assert.equal(continued.selection.items.length, 2);

    const returnedSet = memory.getSet(checkpoint.id);
    assert.equal(createResearchSession(memory, returnedSet).selection.items.length, 2);

    const emptySet = memory.retain(memory.collection([], { operation: 'empty' }), 'empty starting point');
    assert.equal(createResearchSession(memory, emptySet).selection.items.length, 0);
  } finally {
    memory?.close();
  }
});
