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

## Experimental navigator arrangement

The optional `@nostrarium/controller/arrangement` entry point reorganizes
already-requested schema and observation responses for a navigator:

```js
import {
  arrangeCommand,
  arrangeControls,
  arrangeObservation,
  composeCommand,
} from '@nostrarium/controller/arrangement';

const broad = await controller.execute({
  command: 'schema',
  input: 'authors',
  parameters: {},
});
const move = await controller.execute({
  command: 'schema',
  input: 'authors',
  parameters: { operation: 'move' },
});

const controls = arrangeControls(
  broad.response,
  [move.response],
);

const shown = await controller.execute({
  command: 'show',
  input: 'authors',
  parameters: { mode: 'summary' },
});
const observation = arrangeObservation(shown.response);

const composition = arrangeCommand(move.response);
const draft = composeCommand(composition, {
  parameters: { to: 'authoredEvents', limit: 50 },
  resultId: 'authored',
});

// Execution remains a separate, explicit navigator action.
const moved = await controller.execute(draft);
```

Handle-compatible controls are grouped as contact, movement, analysis,
judgment, and collection. Session-wide observation and lifecycle commands
remain visible through the controller and global schema rather than being
misrepresented as handle controls. Every compatible operation remains present.
A focused contract is included only when the caller explicitly requested it;
the arrangement does not fetch schemas, recommend a control, or execute a
sequence.

`arrangeCommand` turns one focused contract into a caller-side composition
description. `composeCommand` accepts navigator-supplied values, checks only
facts declared by that contract, and returns an ordinary visible controller
command. It does not choose values, apply research defaults, execute, or chain
commands. Fluent callers remain free to construct the same command directly.

Observation panels expose only response-declared orientation, evidence,
paging, and context. They do not summarize content, infer domain facts, or
choose what the navigator should inspect next. This entry point is an
experiment over the controller, not engine or vessel semantics.
