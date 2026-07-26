import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { openResearchMemory } from '@nostr-research/memory';

const PRIVATE_KEY = Uint8Array.from(Buffer.from('4'.repeat(64), 'hex'));

test('recorded query becomes an explainable, expandable, combinable durable research path', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-saved-research-'));
  const database = join(directory, 'memory.sqlite');
  const root = finalizeEvent({
    kind: 1,
    created_at: 100,
    tags: [],
    content: 'saved research root',
  }, PRIVATE_KEY);
  const reply = finalizeEvent({
    kind: 1,
    created_at: 200,
    tags: [['e', root.id, '', 'reply']],
    content: 'saved research reply',
  }, PRIVATE_KEY);

  let memory;
  try {
    memory = openResearchMemory(database);
    memory.ingest(root, { relay: 'wss://evidence.example', observedAt: '2026-01-01T00:00:00Z' });
    memory.ingest(reply, { relay: 'wss://evidence.example', observedAt: '2026-01-01T00:01:00Z' });
    const outcome = memory.searchEvents({ ids: [reply.id] });
    const run = memory.recordRun({
      operation: 'event-query',
      inputs: outcome.query,
      startedAt: '2026-01-01T00:02:00Z',
      finishedAt: '2026-01-01T00:02:01Z',
      status: 'completed',
      diagnostics: [],
      results: outcome.results.map((result) => ({
        type: 'event',
        id: result.event.id,
        reasons: result.matchReasons,
        provenance: result.observations,
      })),
    });
    assert.equal(run.operation, 'event-query');
    assert.deepEqual(run.results.map(({ id }) => id), [reply.id]);
    assert.equal(run.results[0].provenance[0].relay, 'wss://evidence.example');

    const selected = memory.createSetFromRun('selected', run.id);
    const expandedResult = memory.expandSet(
      selected.id, 'parents',
      { relationshipTypes: ['reply-parent'], direction: 'outbound' },
    );
    const expanded = memory.getSet(expandedResult.id);
    assert.deepEqual(expanded.members.map(({ id }) => id), [root.id]);
    assert.equal(expanded.members[0].reasons[0].type, 'relationship');

    const manual = memory.createSet('manual');
    memory.addSetMember(manual.id, { type: 'event', id: 'f'.repeat(64) });
    const combinedResult = memory.combineSets('union', expanded.id, manual.id, 'combined');
    const combined = memory.getSet(combinedResult.id);
    assert.deepEqual(combined.members.map(({ id }) => id).sort(), [root.id, 'f'.repeat(64)].sort());

    memory.close();
    memory = openResearchMemory(database);
    const reopened = memory.getSet(combined.id);
    assert.equal(reopened.name, 'combined');
    assert.equal(memory.getSet(expanded.id).members.length, 1);
    assert.equal(memory.getSet(manual.id).members.length, 1);
    const explanation = memory.explainSetMember(
      combined.id, { type: 'event', id: root.id },
    );
    assert.equal(explanation.member.reasons[0].type, 'set-operation');
    memory.close();
    memory = null;
  } finally {
    memory?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
