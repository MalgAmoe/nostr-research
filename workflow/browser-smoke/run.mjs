import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nostr-browser-smoke-'));
const bundlePath = join(temporaryDirectory, 'fixture-worker.js');
let browser;

try {
  await build({
    entryPoints: [new URL('./fixture-worker.js', import.meta.url).pathname],
    outfile: bundlePath,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    logLevel: 'silent',
  });
  const workerSource = await readFile(bundlePath, 'utf8');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.setContent('<!doctype html><title>Nostr browser smoke</title>');
  const responses = await page.evaluate(async (source) => {
    const workerUrl = URL.createObjectURL(new Blob([source], {
      type: 'text/javascript',
    }));
    const worker = new Worker(workerUrl);
    const pending = new Map();
    worker.addEventListener('message', ({ data }) => {
      pending.get(data.commandId)?.(JSON.parse(JSON.stringify(data)));
      pending.delete(data.commandId);
    });

    const send = (message) => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(message.commandId);
        reject(new Error(`Timed out waiting for ${message.commandId}.`));
      }, 5_000);
      pending.set(message.commandId, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
      worker.postMessage(JSON.parse(JSON.stringify(message)));
    });

    const results = [];
    results.push(await send({ commandId: 'early', command: 'status' }));
    results.push(await send({
      type: 'initialize',
      commandId: 'initialize',
      memory: { capacity: 10, archiveCapacity: 2, notebookCapacity: 4 },
      configuration: {
        acquisition: {
          timeoutMs: 1_000,
          observationLimit: 2,
          distinctEventLimit: 2,
          concurrency: 1,
        },
        presentation: { previewLimit: 1, excerptLimit: 80, sizeLimit: 4_000 },
      },
    }));
    results.push(await send({
      commandId: 'acquire',
      command: 'acquire',
      parameters: {
        relays: ['wss://fixture.invalid/'],
        filter: { kinds: [1] },
      },
      resultId: 'recent',
    }));
    results.push(await send({
      commandId: 'relate',
      command: 'relate',
      input: 'recent',
      parameters: {},
      resultId: 'rows',
    }));
    results.push(await send({
      commandId: 'show',
      command: 'show',
      input: 'rows',
      parameters: { mode: 'preview' },
    }));
    results.push(await send({ commandId: 'close', command: 'close' }));
    results.push(await send({ commandId: 'after-close', command: 'status' }));
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    return results;
  }, workerSource);

  check(responses[0].error?.code === 'WORKER_NOT_INITIALIZED',
    'pre-initialization command was not rejected');
  check(responses[1].ok && responses[1].result?.type === 'browser-worker-initialized',
    'initialization failed');
  const acquiredCount = responses[2].result?.handle?.count;
  check(responses[2].ok && Number.isInteger(acquiredCount) && acquiredCount > 0,
    `deterministic acquisition did not retain an event: ${JSON.stringify(responses[2])}`);
  check(responses[2].result.external?.completeness?.boundsReached
    ?.includes('observation-budget'), 'acquisition bound was not visible');
  check(responses[3].ok
    && responses[3].result?.handle?.kind === 'relation'
    && responses[3].result?.handle?.count === acquiredCount,
  'acquisition handle did not transition directly into analysis');
  check(responses[4].ok
    && responses[4].result?.observation === 'preview'
    && responses[4].result?.preview?.length === 1
    && responses[4].result?.omitted === acquiredCount - 1,
  `bounded browser presentation was incorrect: ${JSON.stringify(responses[4])}`);
  check(responses[5].ok && responses[5].result?.type === 'close-session',
    'session did not close');
  check(responses[6].error?.code === 'SESSION_CLOSED',
    'post-close command was not rejected');
  check(errors.length === 0, `browser emitted errors: ${errors.join('; ')}`);

  console.log('browser smoke passed: Worker, memory, acquisition, handles, preview, close');
} finally {
  await browser?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function check(condition, message) {
  if (!condition) throw new Error(`Browser smoke failed: ${message}.`);
}
