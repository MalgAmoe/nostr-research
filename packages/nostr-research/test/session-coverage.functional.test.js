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

    const emptySet = memory.retain(memory.collection([], { operation: 'empty' }), 'empty starting point');
    assert.equal(createResearchSession(memory, emptySet).selection.items.length, 0);
  } finally {
    memory?.close();
  }
});
