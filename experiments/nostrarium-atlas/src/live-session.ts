import { createNavigatorController } from '@nostrarium/controller';
import { createBrowserWorkerTransport } from '@nostrarium/controller/worker';

export type CommandOutcome = Awaited<ReturnType<ReturnType<typeof createNavigatorController>['execute']>>;

let sessionPromise: Promise<ReturnType<typeof createNavigatorController>> | null = null;

export function liveController() {
  if (!sessionPromise) sessionPromise = createSession();
  return sessionPromise;
}

async function createSession() {
  const worker = new Worker(new URL('./research-worker.ts', import.meta.url), { type: 'module' });
  const transport = await createBrowserWorkerTransport({
    worker,
    memory: { capacity: 600, archiveCapacity: 80, notebookCapacity: 80 },
    configuration: {
      acquisition: { timeoutMs: 10000, observationLimit: 80, distinctEventLimit: 60, concurrency: 2, excludeContentWarnings: true },
      presentation: { previewLimit: 20, excerptLimit: 1000, sizeLimit: 50000 },
    },
    responseTimeoutMs: 45000,
  });
  return createNavigatorController({
    request: transport.request,
    closeTransport: transport.close,
    transcript: { maxEntries: 200, maxBytes: 4_000_000 },
  });
}
