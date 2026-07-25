import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { openResearchMemory } from '@nostr-research/memory';

const PRIVATE_KEY = Uint8Array.from(Buffer.from('4'.repeat(64), 'hex'));
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'nostr-research-memory.js');

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

  let memory = openResearchMemory(database);
  memory.ingest(root, { relay: 'wss://evidence.example', observedAt: '2026-01-01T00:00:00Z' });
  memory.ingest(reply, { relay: 'wss://evidence.example', observedAt: '2026-01-01T00:01:00Z' });
  memory.close();

  try {
    const run = cli(database, 'run', 'search', '--id', reply.id, '--output', 'full');
    assert.equal(run.operation, 'event-query');
    assert.deepEqual(run.results.map(({ id }) => id), [reply.id]);
    assert.equal(run.results[0].provenance[0].relay, 'wss://evidence.example');

    const selected = cli(database, 'set', 'from-run', 'selected', run.id, '--output', 'full');
    const expanded = cli(
      database, 'set', 'expand', selected.id, 'parents',
      '--relationship', 'reply-parent', '--output', 'full',
    );
    assert.deepEqual(expanded.members.map(({ id }) => id), [root.id]);
    assert.equal(expanded.members[0].reasons[0].type, 'relationship');

    const manual = cli(database, 'set', 'create', 'manual', '--output', 'full');
    cli(database, 'set', 'add', manual.id, 'event', 'f'.repeat(64));
    const combined = cli(
      database, 'set', 'combine', 'union', expanded.id, manual.id, 'combined',
      '--output', 'full',
    );
    assert.deepEqual(combined.members.map(({ id }) => id).sort(), [root.id, 'f'.repeat(64)].sort());

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

function cli(database, ...arguments_) {
  return JSON.parse(execFileSync(
    process.execPath,
    [CLI, '--db', database, ...arguments_],
    { encoding: 'utf8' },
  ));
}
