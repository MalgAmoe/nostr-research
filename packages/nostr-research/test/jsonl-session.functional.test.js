import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadFixtureEvents } from '../test-support/fixtures.js';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = join(packageDirectory, 'bin', 'nostr-research-session.js');

test('JSONL executable provides one persistent bounded process workflow', async () => {
  const child = spawn(process.execPath, [executable, '--capacity', '3'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin.setDefaultEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  const [event] = loadFixtureEvents();
  const commands = [
    '{"commandId":"broken",',
    JSON.stringify({
      commandId: 'select', command: 'select',
      parameters: { scope: 'corpus', kinds: [1] }, resultId: 'notes',
    }),
    JSON.stringify({
      commandId: 'show', command: 'show', input: 'notes',
      parameters: { previewLimit: 1, excerptLimit: 20, sizeLimit: 1000 },
    }),
    JSON.stringify({
      commandId: 'inspect', command: 'inspect',
      parameters: { subject: { type: 'event', id: event.id }, excerptLimit: 20 },
    }),
    JSON.stringify({
      commandId: 'explain', command: 'explain', input: 'notes',
      parameters: { subject: { type: 'event', id: event.id }, previewLimit: 1 },
    }),
    JSON.stringify({
      commandId: 'status', ifRevision: 1, command: 'status', parameters: {},
    }),
    JSON.stringify({
      commandId: 'unknown', command: 'show', input: 'missing', parameters: {},
    }),
    JSON.stringify({
      commandId: 'conflict', ifRevision: 0, command: 'status', parameters: {},
    }),
    JSON.stringify({
      commandId: 'release', command: 'release', input: 'notes', parameters: {},
    }),
    JSON.stringify({
      commandId: 'released', command: 'show', input: 'notes', parameters: {},
    }),
    JSON.stringify({
      commandId: 'again', command: 'select',
      parameters: { scope: 'corpus' }, resultId: 'again',
    }),
    JSON.stringify({
      commandId: 'reset', ifRevision: 3, command: 'reset', parameters: {},
    }),
    JSON.stringify({
      commandId: 'final-status', command: 'status', parameters: {},
    }),
  ];
  child.stdin.end(`\n${commands.join('\n')}\n`);

  const [code, signal] = await once(child, 'exit');
  assert.equal(code, 0);
  assert.equal(signal, null);
  assert.equal(stderr, '');
  assert.equal(stdout.endsWith('\n'), true);
  const lines = stdout.trimEnd().split('\n');
  assert.equal(lines.length, commands.length);
  const responses = lines.map((line) => JSON.parse(line));

  assert.deepEqual(responses[0], {
    ok: false,
    commandId: null,
    sessionRevision: 0,
    error: {
      code: 'INVALID_COMMAND',
      message: 'Input line is not valid JSON.',
      details: {},
    },
  });
  assert.deepEqual(
    responses.map(({ commandId }) => commandId),
    [null, 'select', 'show', 'inspect', 'explain', 'status', 'unknown', 'conflict',
      'release', 'released', 'again', 'reset', 'final-status'],
  );
  assert.equal(responses[1].sessionRevision, 1);
  assert.equal(responses[2].result.count, 0);
  assert.equal(responses[2].sessionRevision, 1);
  assert.equal(responses[3].result.resident, false);
  assert.equal(responses[3].sessionRevision, 1);
  assert.equal(responses[4].result.member, false);
  assert.equal(responses[5].result.handleCount, 1);
  assert.equal(responses[6].error.code, 'UNKNOWN_RESULT');
  assert.equal(responses[7].error.code, 'REVISION_CONFLICT');
  assert.equal(responses[8].sessionRevision, 2);
  assert.equal(responses[9].error.code, 'UNKNOWN_RESULT');
  assert.equal(responses[10].sessionRevision, 3);
  assert.equal(responses[11].sessionRevision, 4);
  assert.equal(responses[12].result.handleCount, 0);
  assert.equal(responses[12].result.observationBuffer.eventCount, 0);
  assert.equal(responses[12].sessionRevision, 4);
});
