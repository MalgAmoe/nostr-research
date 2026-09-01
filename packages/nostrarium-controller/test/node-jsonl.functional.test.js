import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigatorController } from '@nostrarium/controller';
import { createNodeJsonlTransport } from '@nostrarium/controller/node';

test('one Node JSONL process retains handles, preserves semantic failures, and closes cleanly', async () => {
  const transport = createNodeJsonlTransport({
    workingDirectory: process.cwd(),
    capacity: 10,
    archiveCapacity: 10,
    responseTimeoutMs: 5_000,
  });
  const initialPid = transport.status().pid;
  const controller = createNavigatorController({
    request: transport.request,
    closeTransport: transport.close,
    transcript: { maxEntries: 20, maxBytes: 100_000 },
  });

  const selected = await controller.execute({
    command: 'select',
    parameters: { scope: 'corpus', kinds: [1] },
    resultId: 'notes',
  });
  assert.equal(selected.response.ok, true);

  const shown = await controller.execute({
    command: 'show',
    input: 'notes',
    parameters: { mode: 'summary' },
  });
  assert.equal(shown.response.ok, true);
  assert.equal(transport.status().pid, initialPid);

  const semanticFailure = await controller.execute({
    command: 'show',
    input: 'missing',
    parameters: { mode: 'summary' },
  });
  assert.equal(semanticFailure.response.ok, false);
  assert.equal(semanticFailure.response.error.code, 'UNKNOWN_RESULT');
  assert.equal(transport.status().latestFailure, null);

  const closed = await controller.close();
  assert.equal(closed.response.ok, true);
  assert.equal(transport.status().lifecycle, 'closed');
  await transport.close();
});

test('malformed child stdout rejects with bounded, separate diagnostics and cannot hang', async () => {
  const previousNodeOptions = process.env.NODE_OPTIONS;
  process.env.NODE_OPTIONS = [
    previousNodeOptions,
    '--import',
    new URL('../fixtures/malformed-child.js', import.meta.url).href,
  ].filter(Boolean).join(' ');
  let transport;
  try {
    transport = createNodeJsonlTransport({
      workingDirectory: process.cwd(),
      capacity: 10,
      responseTimeoutMs: 5_000,
    });
  } finally {
    if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = previousNodeOptions;
  }

  await assert.rejects(
    transport.request({ commandId: 'failure', command: 'status', parameters: {} }),
    (error) => {
      assert.equal(error.name, 'NodeJsonlTransportError');
      assert.equal(error.code, 'MALFORMED_STDOUT');
      assert.match(error.details.malformedLineExcerpt, /not-json/);
      assert.ok(error.details.malformedLineExcerpt.length <= 1_024);
      return true;
    },
  );
  await transport.close();
  const status = transport.status();
  assert.equal(status.lifecycle, 'failed');
  assert.match(status.stderrExcerpt, /^diagnostic-/);
  assert.ok(status.stderrOmittedBytes > 0);
  assert.equal(status.pendingCommandId, null);
  assert.equal(status.exitCode, null);
  assert.equal(status.exitSignal, 'SIGTERM');
  assert.equal(status.latestFailure.lifecycle, 'failed');
});

test('spawn failure rejects requests and idempotent close settles on the terminal child state', {
  timeout: 5_000,
}, async () => {
  const transport = createNodeJsonlTransport({
    workingDirectory: new URL(`../fixtures/missing-${process.pid}/`, import.meta.url).pathname,
    capacity: 10,
    responseTimeoutMs: 5_000,
  });

  await assert.rejects(
    transport.request({ commandId: 'spawn-failure', command: 'status', parameters: {} }),
    (error) => {
      assert.equal(error.name, 'NodeJsonlTransportError');
      assert.equal(error.code, 'PROCESS_ERROR');
      assert.equal(error.details.lifecycle, 'failed');
      return true;
    },
  );

  const firstClose = transport.close();
  assert.equal(transport.close(), firstClose);
  await firstClose;

  const status = transport.status();
  assert.equal(status.lifecycle, 'failed');
  assert.equal(status.pendingCommandId, null);
  assert.equal(status.latestFailure.lifecycle, 'failed');
});
