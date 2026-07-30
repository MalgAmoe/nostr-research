import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserWorkerTransport } from '@nostrarium/controller/worker';

test('browser Worker transport initializes once and preserves ordinary correlated commands', async () => {
  const worker = new FixtureWorker();
  const transport = await createBrowserWorkerTransport({
    worker,
    memory: { capacity: 10 },
    responseTimeoutMs: 1_000,
  });

  assert.equal(transport.status().lifecycle, 'open');
  const response = await transport.request({ commandId: 'status-1', command: 'status' });
  assert.equal(response.commandId, 'status-1');
  assert.equal(response.result.type, 'fixture-response');
  assert.equal(worker.messages[0].type, 'initialize');
  assert.deepEqual(worker.messages[0].memory, { capacity: 10 });
  assert.equal(worker.messages[1].command, 'status');

  const firstClose = transport.close();
  assert.equal(transport.close(), firstClose);
  await firstClose;
  assert.equal(worker.terminated, true);
  assert.equal(transport.status().lifecycle, 'closed');
});

test('browser Worker transport rejects mismatched correlation as a terminal failure', async () => {
  const worker = new FixtureWorker();
  const transport = await createBrowserWorkerTransport({
    worker,
    memory: { capacity: 10 },
    responseTimeoutMs: 1_000,
  });
  worker.mismatch = true;

  await assert.rejects(
    transport.request({ commandId: 'expected', command: 'status' }),
    (error) => {
      assert.equal(error.name, 'BrowserWorkerTransportError');
      assert.equal(error.code, 'MISMATCHED_COMMAND_ID');
      return true;
    },
  );
  assert.equal(transport.status().lifecycle, 'failed');
  assert.equal(worker.terminated, true);
});

class FixtureWorker {
  listeners = new Map();
  messages = [];
  mismatch = false;
  terminated = false;

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
  }

  postMessage(message) {
    this.messages.push(structuredClone(message));
    queueMicrotask(() => {
      const response = message.type === 'initialize'
        ? {
          ok: true,
          commandId: message.commandId,
          sessionRevision: 0,
          result: { type: 'browser-worker-initialized' },
          warnings: [],
        }
        : {
          ok: true,
          commandId: this.mismatch ? 'other' : message.commandId,
          sessionRevision: 0,
          result: { type: 'fixture-response' },
          warnings: [],
        };
      for (const listener of this.listeners.get('message') ?? []) {
        listener({ data: response });
      }
    });
  }

  terminate() {
    this.terminated = true;
  }
}
