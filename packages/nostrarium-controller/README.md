# Nostrarium controller

`@nostrarium/controller` is a runtime-neutral mechanical client for the
structured Nostrarium research-session protocol. It allocates and correlates
command IDs, serializes requests, observes revisions, retains a bounded
in-memory transcript, and provides compact response-declared receipts.

It does not execute or validate research operations, choose a current
selection, interpret evidence, or hide synchronization and observation
commands. The injected request function is its only session boundary; a
transport may call an in-process session, a browser Worker, or a JSONL adapter.
The core imports no transport or Node runtime modules.

```js
import { createNavigatorController } from '@nostrarium/controller';

const controller = createNavigatorController({
  request: (command) => session.execute(command),
  closeTransport: async () => {},
  transcript: { maxEntries: 500, maxBytes: 2_000_000 },
});

const { response, receipt } = await controller.execute({
  command: 'select',
  parameters: { scope: 'corpus', kinds: [1] },
  resultId: 'notes',
});

const synchronization = await controller.synchronize();
const state = controller.state();
const history = controller.transcript({ afterSequence: 0, limit: 50 });
await controller.close();
```

For an in-process session, `closeTransport` may be omitted or supplied by the
embedding caller. With the Node transport below, pass `transport.close`
directly, as shown in its example.

The public controller exposes only `execute`, `state`, `transcript`,
`synchronize`, and `close`. `execute` resolves both successful and `ok: false`
protocol responses; request, malformed-response, and correlation failures
reject separately after being recorded. `synchronize` visibly sends ordinary
`list` and `status` commands, and only a successful `list` replaces the cached
handle catalog. The catalog retains the list response's bounded preview,
total count, and omitted count; its revision and staleness flag remain visible
in `state()`.

Transcript limits are required and measured against each retained entry's
UTF-8 JSON serialization. Evicted or individually oversized entries contribute
to visible omitted-entry and omitted-byte totals.

## Node JSONL transport

The Node-specific entry point starts the existing session executable directly
and retains its process-local memory across controller commands:

```js
import { createNavigatorController } from '@nostrarium/controller';
import { createNodeJsonlTransport } from '@nostrarium/controller/node';

const transport = createNodeJsonlTransport({
  workingDirectory: process.cwd(),
  capacity: 2_000,
  archiveCapacity: 500,
  notebookCapacity: 500,
  responseTimeoutMs: 10_000,
});
const controller = createNavigatorController({
  request: transport.request,
  closeTransport: transport.close,
  transcript: { maxEntries: 500, maxBytes: 2_000_000 },
});

await controller.execute({
  command: 'select',
  parameters: { scope: 'corpus', kinds: [1] },
  resultId: 'notes',
});
console.log(transport.status());
await controller.close();
```

Controller closure first sends the session's ordinary `close` command, then
ends the transport input and waits for the child process. Protocol `ok: false`
responses still resolve normally. Process, timeout, malformed-output, and
correlation failures reject with `NodeJsonlTransportError`; its bounded
`details` and `transport.status()` keep lifecycle, stderr, malformed-line, and
exit facts separate from JSONL responses.

A `NodeJsonlTransportError` is terminal for that transport instance because a
strict one-request/one-response stream can no longer be trusted after transport
failure. Start a new session to continue. The bounded controller transcript and
transport diagnostics remain available for diagnosis or caller-directed
replay; neither layer retries or replays commands automatically.

Interpretations over the controller deliberately live outside this package.
Callers may build disposable schema-backed controls without changing the
controller or the research engine.

## Browser Worker transport

The browser-specific transport connects the same neutral controller to the
research engine's module Worker:

```js
import { createNavigatorController } from '@nostrarium/controller';
import { createBrowserWorkerTransport } from '@nostrarium/controller/worker';

const worker = new Worker(new URL('./research-worker.js', import.meta.url), {
  type: 'module',
});
const transport = await createBrowserWorkerTransport({
  worker,
  memory: { capacity: 1_000, archiveCapacity: 300, notebookCapacity: 300 },
  configuration: { presentation: { previewLimit: 8 } },
  responseTimeoutMs: 45_000,
});
const controller = createNavigatorController({
  request: transport.request,
  closeTransport: transport.close,
  transcript: { maxEntries: 500, maxBytes: 2_000_000 },
});
```

The transport performs the Worker lifecycle initialization and then passes
ordinary correlated session commands and responses unchanged. Closing the
controller sends the normal session `close` command before terminating the
Worker. It adds no research operations or browser-specific command semantics.
