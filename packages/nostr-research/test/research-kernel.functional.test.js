import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { openResearchMemory } from '@nostr-research/memory';

const ALICE_SECRET = Uint8Array.from(Buffer.from('a'.repeat(64), 'hex'));
const BOB_SECRET = Uint8Array.from(Buffer.from('b'.repeat(64), 'hex'));
const alice = getPublicKey(ALICE_SECRET);
const bob = getPublicKey(BOB_SECRET);

test('selection, bounded traversal, projection, retention, reopen, and continuation compose', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-kernel-'));
  const database = join(directory, 'memory.sqlite');
  const metadata = finalizeEvent({
    kind: 0, created_at: 10, tags: [],
    content: JSON.stringify({
      name: 'alice', display_name: 'Alice Researcher',
      nip05: 'alice@example.test', about: 'Investigates local Nostr conversations.',
    }),
  }, ALICE_SECRET);
  const root = finalizeEvent({
    kind: 1, created_at: 20, tags: [['t', 'research']], content: 'root',
  }, ALICE_SECRET);
  const reply = finalizeEvent({
    kind: 1, created_at: 30,
    tags: [['e', root.id, '', 'root'], ['e', root.id, '', 'reply'], ['p', alice]],
    content: 'direct reply',
  }, BOB_SECRET);
  const ambiguous = finalizeEvent({
    kind: 1, created_at: 40, tags: [['e', reply.id]], content: 'fallback reply',
  }, ALICE_SECRET);
  const cycle = finalizeEvent({
    kind: 1, created_at: 50,
    tags: [['e', ambiguous.id, '', 'reply'], ['q', root.id]],
    content: 'cycle-like path',
  }, BOB_SECRET);

  let memory = openResearchMemory(database);
  try {
    for (const event of [metadata, root, reply, ambiguous, cycle]) {
      memory.ingest(event, {
        relay: 'wss://fixture.example', observedAt: '2026-01-01T00:00:00Z',
      });
    }
    assert.deepEqual(memory.resolve('alice@example.test'), { type: 'account', id: alice });

    const selected = memory.select({ authors: [alice], kinds: [1], order: 'oldest' });
    const traversed = memory.traverse(selected, {
      relationshipTypes: ['reply-root', 'reply-parent', 'author', 'topic'],
      direction: 'both', depth: 4, limit: 20,
    });
    assert.equal(new Set(traversed.items.map(({ subject }) => `${subject.type}:${subject.id}`)).size,
      traversed.items.length);
    assert.ok(traversed.context.relationships.some(
      ({ evidence }) => evidence.interpretation === 'best-effort-fallback',
    ));

    const compact = memory.project(traversed, {
      mode: 'compact', excerptLimit: 20, previewLimit: 2,
    });
    assert.ok(compact.results.some((result) => result.type === 'account' && result.nip05));
    assert.ok(compact.relationships.every((relationship) => relationship.interpretation));
    assert.ok(memory.project(traversed, { mode: 'full' }).results
      .some((result) => result.event?.sig.length === 128));

    const saved = memory.retain(traversed, 'composed evidence');
    memory.close();
    memory = openResearchMemory(database);

    const continued = memory.traverse([{ type: 'set', id: saved.id }], {
      relationshipTypes: ['author', 'mentioned-account'],
      direction: 'outbound', depth: 1, limit: 20,
    });
    assert.ok(continued.items.some(({ subject }) => (
      subject.type === 'account' && subject.id === bob
    )));

    const thread = memory.thread(root.id, { depth: 4, limit: 20 });
    assert.ok(thread.directReplies.some(({ target }) => target.id === reply.id));
    assert.ok(thread.ambiguous.some(({ evidence }) => (
      evidence.interpretation === 'best-effort-fallback'
    )));
    assert.ok(thread.participants.some(({ id }) => id === alice));
    assert.ok(thread.participants.some(({ id }) => id === bob));
  } finally {
    memory?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
