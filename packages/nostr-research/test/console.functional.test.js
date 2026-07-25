import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { openResearchMemory } from '@nostr-research/memory';

const CONSOLE = new URL('../bin/nostr-research-console.js', import.meta.url);
const KEY = Uint8Array.from(Buffer.from('9'.repeat(64), 'hex'));

test('one console process preserves JavaScript state and composes a bounded research loop', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-console-'));
  const database = join(directory, 'memory.sqlite');
  const eventIds = [];
  let memory = openResearchMemory(database);
  try {
    for (let index = 0; index < 30; index += 1) {
      const event = finalizeEvent({
        kind: 1,
        created_at: 1_700_000_000 + index,
        tags: index === 0 ? [] : [['e', eventIds[index - 1], '', 'reply']],
        content: `console evidence ${index}`,
      }, KEY);
      eventIds.push(event.id);
      memory.ingest(event, {
        relay: 'wss://console-fixture.example/',
        observedAt: '2026-07-25T00:00:00.000Z',
      });
    }
    memory.close();
    memory = null;

    const source = [
      "const loaded = research.load({ order: 'oldest', limit: 30 })",
      "await Promise.resolve('AWAIT_OK')",
      "const found = research.events({ text: ['console evidence'], limit: 30 })",
      'const selected = research.use(found)',
      `const inspected = research.inspect({ type: 'event', id: '${eventIds[0]}' })`,
      `const walked = research.traverse([{ type: 'event', id: '${eventIds[1]}' }], `
        + "{ relationshipTypes: ['reply-parent'], direction: 'outbound', depth: 1, limit: 10 })",
      "const saved = research.retain(walked, 'console retained')",
      'found',
      "console.log('SCENARIO:' + JSON.stringify({ persistentCount: loaded.items.length, inspected: inspected.subject.id, "
        + 'walked: walked.items.length, saved: saved.memberCount }))',
      '.exit',
      '',
    ].join('\n');
    const result = spawnSync(process.execPath, [CONSOLE.pathname, '--db', database, '--capacity', '50'], {
      input: source,
      encoding: 'utf8',
      timeout: 10_000,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /type: 'result-collection'/);
    assert.match(result.stdout, /count: 30/);
    assert.match(result.stdout, /omitted: 25/);
    assert.match(result.stdout, /AWAIT_OK/);
    assert.doesNotMatch(result.stdout, /console evidence 0/);
    const marker = result.stdout.match(/SCENARIO:(\{.*\})/);
    assert.ok(marker, result.stdout);
    assert.deepEqual(JSON.parse(marker[1]), {
      persistentCount: 30,
      inspected: eventIds[0],
      walked: 2,
      saved: 2,
    });

    memory = openResearchMemory(database);
    assert.equal(memory.summary().events, 30);
    assert.equal(memory.listSets()[0].memberCount, 2);
  } finally {
    memory?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
