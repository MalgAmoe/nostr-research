import assert from 'node:assert/strict';
import test from 'node:test';

test('browser Worker adapter owns one real session through message and close lifecycle', async () => {
  const originalAddEventListener = globalThis.addEventListener;
  const originalPostMessage = globalThis.postMessage;
  const responses = [];
  let messageListener;
  globalThis.addEventListener = (name, listener) => {
    if (name === 'message') messageListener = listener;
  };
  globalThis.postMessage = (response) => responses.push(response);

  try {
    await import('../src/browser-worker.js');

    const initialize = await dispatch({
      type: 'initialize',
      commandId: 'initialize',
      memory: { capacity: 10 },
    });
    assert.equal(initialize.ok, true);
    assert.equal(initialize.result.type, 'browser-worker-initialized');

    const schema = await dispatch({
      commandId: 'schema',
      command: 'schema',
      parameters: {},
    });
    assert.equal(schema.ok, true);
    assert.equal(schema.result.type, 'collection-pipeline-schema');

    const malformed = await dispatch(null);
    assert.equal(malformed.ok, false);
    assert.equal(malformed.commandId, null);
    assert.equal(malformed.error.code, 'INVALID_COMMAND');

    const closed = await dispatch({
      commandId: 'close',
      command: 'close',
      parameters: {},
    });
    assert.equal(closed.ok, true);

    const afterClose = await dispatch({
      commandId: 'after-close',
      command: 'schema',
      parameters: {},
    });
    assert.equal(afterClose.ok, false);
    assert.equal(afterClose.error.code, 'SESSION_CLOSED');
  } finally {
    if (originalAddEventListener === undefined) delete globalThis.addEventListener;
    else globalThis.addEventListener = originalAddEventListener;
    if (originalPostMessage === undefined) delete globalThis.postMessage;
    else globalThis.postMessage = originalPostMessage;
  }

  async function dispatch(data) {
    const index = responses.length;
    messageListener({ data });
    while (responses.length === index) await new Promise((resolve) => setImmediate(resolve));
    return responses[index];
  }
});
