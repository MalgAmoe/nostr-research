import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadFixtureEvents } from '../test-support/fixtures.js';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = join(packageDirectory, 'bin', 'nostr-research-session.js');
const loopbackAvailable = await supportsLoopbackListener();

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
      commandId: 'select', command: 'select', parameters: { kinds: [1] }, resultId: 'notes',
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
      commandId: 'again', command: 'select', parameters: {}, resultId: 'again',
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
  assert.equal(responses[12].result.corpus.eventCount, 0);
  assert.equal(responses[12].sessionRevision, 4);
});

test('JSONL executable cancels active external work on a termination signal', async (t) => {
  if (!loopbackAvailable) return t.skip('sandbox forbids loopback listeners');
  const sockets = new Set();
  const relay = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => relay.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    if (relay.listening) await new Promise((resolve) => relay.close(resolve));
  });

  const child = spawn(process.execPath, [executable, '--capacity', '3'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  child.stdin.setDefaultEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });

  const { port } = relay.address();
  child.stdin.write(`${JSON.stringify({
    commandId: 'hanging-acquire',
    command: 'acquire',
    parameters: {
      relays: [`wss://127.0.0.1:${port}/`],
      filter: { kinds: [1] },
      timeoutMs: 60_000,
      observationLimit: 10,
      distinctEventLimit: 10,
    },
    resultId: 'never-installed',
  })}\n`);

  const [relaySocket] = await withTimeout(
    once(relay, 'connection'), 2_000, 'external operation did not start',
  );
  const relaySocketClosed = once(relaySocket, 'close');
  const started = Date.now();
  child.kill('SIGTERM');
  const [code, signal] = await withTimeout(
    once(child, 'exit'), 2_000, 'signal shutdown did not cancel active external work',
  );

  assert.equal(code, 143);
  assert.equal(signal, null);
  assert.ok(Date.now() - started < 2_000);
  assert.equal(stderr, '');
  const lines = stdout.trim().length ? stdout.trimEnd().split('\n') : [];
  assert.ok(lines.length <= 1);
  for (const line of lines) JSON.parse(line);
  await withTimeout(relaySocketClosed, 2_000, 'session closure left the relay socket open');
  assert.equal(sockets.size, 0, 'session closure closes the owned relay socket');
});

async function withTimeout(promise, milliseconds, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function supportsLoopbackListener() {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return true;
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') return false;
    throw error;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}
