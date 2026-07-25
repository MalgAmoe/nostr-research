import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'nostr-research-memory.js');
const REPOSITORY_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('CLI projections remain concise, complete, deterministic, and composable', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-cli-output-'));
  const database = join(directory, 'memory.sqlite');
  try {
    cliText(database, 'import-fixture');

    const compactText = cliText(database, 'search');
    const compact = JSON.parse(compactText);
    const fullText = cliText(database, 'search', '--output', 'full');
    const full = JSON.parse(fullText);
    assert.ok(compactText.length < fullText.length);
    assert.equal(compact.results[0].event, undefined);
    assert.ok(compact.results[0].contentExcerpt.length <= 160);
    assert.equal(full.results[0].event.sig.length, 128);
    assert.equal(full.results[0].observations[0].relay, 'wss://fixture.example');

    const identifiers = JSON.parse(cliText(database, '--output', 'ids', 'search'));
    assert.ok(identifiers.every((id) => /^[0-9a-f]{64}$/.test(id)));
    const inspected = JSON.parse(cliText(database, 'inspect', identifiers[0]));
    assert.equal(inspected.event.id, identifiers[0]);

    const records = cliText(database, 'search', '--output', 'ndjson')
      .trim().split('\n').map((line) => JSON.parse(line));
    assert.equal(records[0].type, 'query');
    assert.deepEqual(records.slice(1).map(({ id }) => id), identifiers);

    const relationships = JSON.parse(cliText(database, 'related', 'event', identifiers[0]));
    assert.deepEqual(Object.keys(relationships.subject), ['type', 'id']);
    assert.ok(relationships.relationships.length > 0);
    assert.ok(relationships.relationships.every((relationship) => (
      relationship.sourceEvent === undefined && relationship.targetEvent === undefined
    )));

    const thread = JSON.parse(cliText(database, 'thread', identifiers[0]));
    assert.equal(thread.start.type, 'event');
    assert.ok(Array.isArray(thread.ancestors));
    assert.ok(Array.isArray(thread.directReplies));
    assert.ok(Array.isArray(thread.descendants));
    assert.ok(Array.isArray(thread.participants));
    assert.ok(thread.ambiguous.some(
      ({ evidence }) => evidence.interpretation === 'best-effort-fallback',
    ));

    const run = JSON.parse(cliText(
      database, 'run', 'search', '--id', identifiers[0], '--output', 'full',
    ));
    const runList = JSON.parse(cliText(database, 'run', 'list'));
    assert.equal(runList.runs[0].id, run.id);
    assert.equal(runList.runs[0].resultCount, 1);
    assert.equal(runList.runs[0].results, undefined);

    const set = JSON.parse(cliText(database, 'set', 'from-run', 'selection', run.id));
    assert.equal(set.memberCount, 1);
    const setList = JSON.parse(cliText(database, 'set', 'list'));
    assert.equal(setList.sets[0].memberCount, 1);
    assert.equal(setList.sets[0].members, undefined);
    assert.equal(setList.sets[0].preview[0].id, identifiers[0]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('CLI rejects unsupported output modes with a useful non-zero error', () => {
  const result = spawnSync(
    process.execPath,
    [CLI, '--db', 'unused.sqlite', 'search', '--output', 'table'],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported --output mode.*compact, full, ids, or ndjson/);
});

test('documented root npm launcher emits parseable CLI output without an npm banner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-root-launcher-'));
  const database = join(directory, 'memory.sqlite');
  try {
    cliText(database, 'import-fixture');
    const stdout = execFileSync(
      'npm',
      ['run', '--silent', 'research', '--', '--db', database, 'search', '--text', 'fixture'],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8' },
    );
    const output = JSON.parse(stdout);
    assert.ok(output.results.length > 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function cliText(database, ...arguments_) {
  return execFileSync(process.execPath, [CLI, '--db', database, ...arguments_], {
    encoding: 'utf8',
  });
}
