import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { finalizeEvent } from 'nostr-tools';
import { loadFixtureEvents } from '@nostr-research/memory';
import { createPlaygroundServer } from './server.js';

async function post(origin, path, body = {}) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  assert.equal(response.status, 200, value.error);
  return value;
}

async function postStream(origin, path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return (await response.text()).trim().split('\n').map(JSON.parse);
}

async function listenOrSkip(server, context) {
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return true;
  } catch (error) {
    if (error?.code === 'EPERM') {
      context.skip('sandbox forbids loopback listeners');
      return false;
    }
    throw error;
  }
}

function controlledSource() {
  const [root] = loadFixtureEvents();
  const reply = finalizeEvent({
    kind: 1,
    created_at: root.created_at + 1,
    tags: [['e', root.id, '', 'reply']],
    content: 'Controlled reply',
  }, Uint8Array.from(Buffer.from('7'.repeat(64), 'hex')));
  const acquireEvents = async (memory, options) => {
    const observations = [root, reply].map((event) => {
      const ingested = memory.ingest(event, {
        relay: options.relays[0], observedAt: '2026-01-01T00:00:00.000Z',
      });
      return { eventId: event.id, observations: [ingested.observation] };
    });
    const relays = [{
      relay: options.relays[0], contacted: true, outcome: 'eose', received: 2,
      invalid: 0, duplicate: 0, newlyStored: 2, observations: 2, diagnostic: null,
    }];
    const counts = { received: 2, invalid: 0, duplicate: 0, newlyStored: 2, observations: 2 };
    options.onProgress({ completionReason: null, counts, relays });
    const result = {
      requested: { filter: options.filter, relays: options.relays },
      budget: { timeoutMs: options.timeoutMs, eventLimit: options.eventLimit, concurrency: 1 },
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
      completionReason: 'completed', relays, counts, acquiredObservations: observations,
    };
    result.collection = memory.asCollection(result);
    result.coverage = memory.recordAcquisitionCoverage(result);
    return result;
  };
  return { root, reply, acquireEvents };
}

test('server adapter completes acquisition, focus, traversal, back, checkpoint, and reopen', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-playground-'));
  const database = join(directory, 'research.sqlite');
  const { root, acquireEvents } = controlledSource();
  const server = createPlaygroundServer({ acquireEvents });
  if (!await listenOrSkip(server, context)) {
    rmSync(directory, { recursive: true, force: true });
    return;
  }
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    let state = await post(origin, '/api/open', { path: database });
    assert.equal(state.selection.results.length, 0);

    const messages = await postStream(origin, '/api/acquire', {
      relays: ['wss://controlled.example'], kinds: [1], eventLimit: 10, timeoutMs: 1000,
    });
    assert.equal(messages[0].type, 'progress');
    state = messages.at(-1).state;
    assert.equal(state.selection.results.length, 2);
    assert.equal(state.lastAcquisition.relays[0].outcome, 'eose');

    state = await post(origin, '/api/exclude', { value: { type: 'event', id: root.id } });
    assert.equal(state.selection.results.length, 1);
    assert.equal(state.excludedSelection.results[0].id, root.id);
    state = await post(origin, '/api/include', { value: { type: 'event', id: root.id } });
    assert.equal(state.selection.results.length, 2);
    assert.equal(state.excludedSelection.results.length, 0);

    state = await post(origin, '/api/focus', { value: { type: 'event', id: root.id } });
    assert.equal(state.session.focus.id, root.id);
    state = await post(origin, '/api/traverse', {
      relationshipType: 'reply-parent', direction: 'inbound', branchName: 'replies',
    });
    assert.equal(state.session.action.type, 'branch');
    assert.equal(state.session.branches[0], 'replies');
    assert.equal(state.selection.results.length, 2);
    state = await post(origin, '/api/back');
    assert.equal(state.session.action.type, 'back');
    assert.equal(state.session.focus.id, root.id);

    state = await post(origin, '/api/checkpoint', { name: 'smoke findings' });
    const savedId = state.sets[0].id;
    state = await post(origin, '/api/new-session');
    assert.equal(state.selection.results.length, 0);
    state = await post(origin, '/api/open-set', { id: savedId });
    assert.equal(state.selection.results.length, 2);
    assert.equal(state.session.selection.context.operation, 'research-set');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});

async function webdriverRequest(port, path, body, method = 'POST') {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    ...(body === undefined ? {} : {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  const value = await response.json();
  if (!response.ok || value.value?.error) {
    throw new Error(value.value?.message ?? `WebDriver request failed (${response.status})`);
  }
  return value.value;
}

async function waitFor(check, message, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${message}`);
}

async function startSafariDriver(context) {
  if (process.platform !== 'darwin') {
    context.skip('browser smoke currently uses the system Safari WebDriver');
    return null;
  }
  const port = 4444;
  const processHandle = spawn('/usr/bin/safaridriver', ['--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  processHandle.stderr.on('data', (chunk) => { diagnostic += chunk; });
  try {
    await waitFor(async () => {
      try {
        await webdriverRequest(port, '/status', undefined, 'GET');
        return true;
      } catch {
        return false;
      }
    }, 'Safari WebDriver to start', 5000);
    const created = await webdriverRequest(port, '/session', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    });
    return { port, processHandle, sessionId: created.sessionId };
  } catch (error) {
    processHandle.kill();
    context.skip(`Safari WebDriver unavailable: ${diagnostic.trim() || error.message}`);
    return null;
  }
}

test('browser completes the controlled research vertical slice', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'nostr-playground-browser-'));
  const database = join(directory, 'research.sqlite');
  const { root, acquireEvents } = controlledSource();
  const server = createPlaygroundServer({ acquireEvents });
  if (!await listenOrSkip(server, context)) {
    rmSync(directory, { recursive: true, force: true });
    return;
  }
  const driver = await startSafariDriver(context);
  if (!driver) {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
    return;
  }
  const command = (path, body, method = 'POST') => webdriverRequest(
    driver.port, `/session/${driver.sessionId}${path}`, body, method,
  );
  const evaluate = (script, args = []) => command('/execute/sync', { script, args });
  const until = (script, message) => waitFor(() => evaluate(script), message);
  const artifactDirectory = process.env.PLAYGROUND_BROWSER_ARTIFACT_DIR
    ? resolve(process.env.PLAYGROUND_BROWSER_ARTIFACT_DIR)
    : null;
  const evidence = {
    capturedAt: new Date().toISOString(),
    browser: 'Safari WebDriver',
    controlledSource: true,
    steps: [],
  };
  const capture = async (name) => {
    if (!artifactDirectory) return;
    mkdirSync(artifactDirectory, { recursive: true });
    const screenshot = await command('/screenshot');
    writeFileSync(join(artifactDirectory, `013-${name}.png`), Buffer.from(screenshot, 'base64'));
    evidence.steps.push({
      name,
      url: await command('/url', undefined, 'GET'),
      visibleState: await evaluate(`
        return {
          databaseStatus: document.querySelector('#database-status').textContent,
          selectionCount: document.querySelector('#selection-count').textContent,
          selectionContext: document.querySelector('#selection-context').textContent,
          focus: document.querySelector('#focus').textContent,
          exclusions: document.querySelector('#exclusions').textContent,
          action: document.querySelector('#action').textContent,
          relayProgress: document.querySelector('#relay-progress').textContent.trim(),
          savedSet: document.querySelector('#saved-sets').selectedOptions[0]?.textContent ?? null,
          cardSubjects: [...document.querySelectorAll('#selection .card')].map(
            card => ({ type: card.dataset.subjectType, id: card.dataset.subjectId })
          ),
          viewport: { width: innerWidth, height: innerHeight },
          documentWidth: {
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth
          }
        };
      `),
    });
  };
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    await command('/url', { url: origin });
    await until('return document.readyState === "complete"', 'page load');
    await evaluate(`
      document.querySelector('#database-path').value = arguments[0];
      document.querySelector('#open-form button').click();
    `, [database]);
    await until('return document.querySelector("#database-status").textContent.startsWith("Open:")', 'database open');

    await evaluate(`
      document.querySelector('#relays').value = 'wss://controlled.example';
      document.querySelector('#kinds').value = '1';
      document.querySelector('#event-limit').value = '10';
      document.querySelector('#timeout').value = '1000';
      document.querySelector('#acquire').click();
    `);
    await until('return document.querySelectorAll("#selection .card").length === 2 && !document.querySelector("#acquire").disabled', 'controlled acquisition');
    assert.match(await evaluate('return document.querySelector("#relay-progress").textContent'), /eose|completed/u);
    await capture('acquired');

    const selector = `.card[data-subject-id="${root.id}"]`;
    await evaluate(`
      [...document.querySelectorAll('#selection .card')].find(
        card => card.dataset.subjectId === arguments[0]
      ).querySelector('.actions button').click();
    `, [root.id]);
    await until(`return document.querySelector(${JSON.stringify(selector)}).classList.contains("focused")`, 'event focus');
    await capture('focused');

    await evaluate(`
      const card = document.querySelector(arguments[0]);
      [...card.querySelectorAll('button')].find(button => button.textContent === 'Exclude').click();
    `, [selector]);
    await until('return document.querySelectorAll("#excluded-results .card").length === 1', 'provisional exclusion');
    await capture('excluded');
    await evaluate(`
      [...document.querySelectorAll('#excluded-results button')].find(
        button => button.textContent === 'Re-include'
      ).click();
    `);
    await until('return document.querySelectorAll("#selection .card").length === 2 && document.querySelectorAll("#excluded-results .card").length === 0', 'provisional re-inclusion');
    await capture('re-included');

    await evaluate(`
      document.querySelector('#relationship').value = 'reply-parent';
      document.querySelector('#direction').value = 'inbound';
      document.querySelector('#branch-name').value = 'replies';
      document.querySelector('#traverse-form button').click();
    `);
    await until('return document.querySelector("#action").textContent === "branch"', 'relationship traversal branch');
    await capture('traversed-branch');
    await evaluate('document.querySelector("#back").click()');
    await until('return document.querySelector("#action").textContent === "back"', 'research-state back');
    await capture('back');

    await evaluate(`
      document.querySelector('#checkpoint-name').value = 'browser smoke findings';
      document.querySelector('#checkpoint-form button').click();
    `);
    await until('return document.querySelector("#saved-sets").options.length === 1 && document.querySelector("#saved-sets").value', 'checkpoint');
    await capture('checkpoint');
    await evaluate('document.querySelector("#new-session").click()');
    await until('return document.querySelector("#selection-count").textContent === "0"', 'new empty session');
    await capture('empty-session');
    await evaluate('document.querySelector("#open-set").click()');
    await until('return document.querySelector("#selection-count").textContent === "2" && document.querySelector("#selection-context").textContent.includes("Opened durable research set")', 'checkpoint reopen');
    await capture('checkpoint-reopened');
    await command('/window/rect', { width: 420, height: 800 });
    await until('return innerWidth <= 420', 'narrow viewport');
    assert.equal(await evaluate(
      'return document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    ), true);
    await capture('narrow');
    if (artifactDirectory) {
      writeFileSync(
        join(artifactDirectory, '013-browser-trace.json'),
        `${JSON.stringify(evidence, null, 2)}\n`,
      );
    }
  } finally {
    await command('', undefined, 'DELETE').catch(() => {});
    driver.processHandle.kill();
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
