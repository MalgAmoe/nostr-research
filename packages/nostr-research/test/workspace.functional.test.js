import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import {
  createResearchSession,
  createResearchWorkspace,
  openResearchMemory,
  subject,
} from '@nostr-research/memory';

const ALICE_KEY = Uint8Array.from(Buffer.from('7'.repeat(64), 'hex'));
const BOB_KEY = Uint8Array.from(Buffer.from('8'.repeat(64), 'hex'));

test('bounded workspace supports an iterative public research loop over durable evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-workspace-'));
  const database = join(directory, 'memory.sqlite');
  const root = sign({
    kind: 1, created_at: 10, tags: [['t', 'Research']], content: 'alpha local evidence',
  }, ALICE_KEY);
  const reply = sign({
    kind: 1, created_at: 20,
    tags: [['e', root.id, '', 'reply'], ['t', 'Research']],
    content: 'beta iterative evidence',
  }, BOB_KEY);
  const quote = sign({
    kind: 1, created_at: 30, tags: [['q', root.id], ['t', 'Other']],
    content: 'gamma quoted evidence',
  }, BOB_KEY);
  const later = sign({
    kind: 7, created_at: 40, tags: [['e', reply.id], ['t', 'Research']],
    content: 'delta reaction',
  }, ALICE_KEY);
  const newest = sign({
    kind: 1, created_at: 50, tags: [['t', 'Research']], content: 'epsilon acquired later',
  }, BOB_KEY);
  let memory = openResearchMemory(database);
  let workspace;
  try {
    for (const event of [root, reply, quote, later]) ingest(memory, event, 'wss://one.example/');

    workspace = createResearchWorkspace(memory, { capacity: 3 });
    const loaded = workspace.load({ order: 'oldest', limit: 3 });
    assert.deepEqual(loaded.collection.items.map(({ subject: item }) => item.id), [
      root.id, reply.id, quote.id,
    ]);
    assert.deepEqual(workspace.describe(), {
      capacity: 3,
      eventCount: 3,
      remainingCapacity: 0,
      evictions: 0,
      authors: 2,
      kinds: 1,
      tags: 4,
      outboundRelationships: 8,
      inboundRelationships: 8,
    });

    assert.deepEqual(
      workspace.select({ text: ['iterative'] }).items.map(({ subject: item }) => item.id),
      [reply.id],
    );
    assert.deepEqual(
      workspace.select({ authors: [reply.pubkey], order: 'oldest' })
        .items.map(({ subject: item }) => item.id),
      [reply.id, quote.id],
    );
    assert.deepEqual(
      workspace.select({ tags: { '#t': ['Research'] }, order: 'oldest' })
        .items.map(({ subject: item }) => item.id),
      [root.id, reply.id],
    );

    const outbound = workspace.traverse([subject('event', reply.id)], {
      relationshipTypes: ['reply-parent'], direction: 'outbound', depth: 1, limit: 10,
    });
    assert.ok(outbound.context.relationships.some(
      (edge) => edge.target.id === root.id && edge.evidence.protocol === 'NIP-10',
    ));
    const inbound = workspace.traverse([subject('event', root.id)], {
      relationshipTypes: ['reply-parent', 'quoted-event'],
      direction: 'inbound', depth: 1, limit: 10,
    });
    assert.deepEqual(
      inbound.items.filter(({ role }) => role === 'discovery')
        .map(({ subject: item }) => item.id).sort(),
      [quote.id, reply.id].sort(),
    );
    assert.equal(
      workspace.inspect(subject('event', reply.id)).provenance[0].relay,
      'wss://one.example/',
    );

    const session = createResearchSession(
      workspace, workspace.select({ tags: { t: ['Research'] }, order: 'oldest' }),
    );
    session.traverse({
      relationshipTypes: ['reply-parent'], direction: 'both', depth: 1, limit: 10,
    });
    assert.equal(session.view('subject-list', { mode: 'ids' }).length, 2);
    const retained = session.checkpoint('workspace findings');
    assert.equal(memory.getSet(retained.id).members.length, 2);

    const staleReplyCollection = workspace.select({ ids: [reply.id] });
    assert.equal(staleReplyCollection.items[0].record.observations.length, 1);
    memory.ingest(reply, {
      relay: 'wss://two.example/', observedAt: '2026-01-02T00:00:00.000Z',
    });
    const refreshed = workspace.add(staleReplyCollection);
    assert.deepEqual(refreshed.refreshed, [reply.id]);
    assert.equal(workspace.describe().eventCount, 3);
    assert.equal(workspace.inspect(subject('event', reply.id)).provenance.length, 2);

    ingest(memory, newest, 'wss://new.example/');
    const increment = workspace.add([
      subject('event', later.id),
      subject('event', newest.id),
      subject('event', newest.id),
    ]);
    assert.deepEqual(increment.added, [later.id, newest.id]);
    assert.deepEqual(increment.refreshed, [newest.id]);
    assert.deepEqual(increment.evicted, [root.id, reply.id]);
    assert.equal(workspace.describe().eventCount, 3);
    assert.ok(memory.getEvent(root.id), 'FIFO eviction must not delete durable evidence');

    workspace.close();
    memory.close();
    memory = openResearchMemory(database);
    workspace = createResearchWorkspace(memory, { capacity: 3 });
    const recreated = workspace.load({ order: 'oldest', limit: 3 });
    assert.deepEqual(recreated.collection.items.map(({ subject: item }) => item.id), [
      root.id, reply.id, quote.id,
    ]);
    assert.equal(workspace.inspect(subject('event', reply.id)).provenance.length, 2);
    assert.ok(memory.getEvent(root.id));
    assert.ok(memory.getEvent(newest.id));
  } finally {
    workspace?.close();
    memory?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

function ingest(memory, event, relay) {
  memory.ingest(event, {
    relay,
    observedAt: '2026-01-01T00:00:00.000Z',
  });
}

function sign(template, key) {
  return finalizeEvent(template, key);
}
