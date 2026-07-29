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
