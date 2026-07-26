# Nostr Research memory

`@nostr-research/memory` is a UI-independent research library for canonical
Nostr evidence. The active runtime is one capacity-bounded, process-local
corpus. Events, observations, derived relationships, and retained selections
all belong to that owner.

```js
import {
  acquireRelayEvents,
  createInMemoryResearchMemory,
  createResearchSession,
  expandResearch,
  resolveReplyContexts,
} from '@nostr-research/memory';

const memory = createInMemoryResearchMemory({ capacity: 500 });
const session = createResearchSession(memory);

memory.ingest(event, {
  relay: 'wss://relay.example',
  observedAt: new Date().toISOString(),
});

const notes = memory.select({ kinds: [1], text: ['nostr'] });
session.replace(notes);
memory.close(); // clears all resident state
```

`ingest` stores immutable canonical evidence and records each observation.
Capacity uses deterministic FIFO eviction. `describe()` reports capacity,
resident counts, index counts, pressure, and total evictions; ingestion and
acquisition results identify additions, refreshes, and evictions. Eviction
removes resident evidence and its derived indexes, while retained selections keep
their stable subject references. `inspect(subject)` reports `resident: false`
when a retained event reference no longer has canonical evidence in the
corpus.

Local operations never contact relays. `select` is the canonical local event
selection operation. Account resolution, `searchAccounts`, `currentEvent`,
`follows`, `traverse`, `thread`, `project`, facets, sessions, and retained
selection operations all use the same resident corpus.

Relay acquisition is explicit:

```js
const acquired = await acquireRelayEvents(memory, {
  relays: ['wss://relay.example'],
  filter: { kinds: [1], limit: 20 },
  observationLimit: 40,
  distinctEventLimit: 20,
  timeoutMs: 5_000,
  concurrency: 2,
});
```

The observation limit bounds accepted valid `EVENT` messages across all
relays; the distinct-event limit bounds unique canonical event IDs. Duplicate
relay observations consume only the observation budget. The result reports
received packets, accepted and duplicate observations, distinct acquired
events, newly stored corpus events, the stopping bound, provenance, complete
attempt coverage, and corpus changes. Attempt coverage is returned directly;
the corpus does not keep a global acquisition history.
Cancellation uses an `AbortSignal`.

Targeted operations also receive the single corpus:

```js
const expanded = await expandResearch(memory, notes, {
  relays: ['wss://relay.example'],
  relationshipTypes: ['reply-parent', 'quoted-event'],
  direction: 'outbound',
  depth: 2,
  limit: 50,
  observationLimit: 200,
  distinctEventLimit: 100,
});

const contexts = await resolveReplyContexts(
  memory,
  [{ type: 'account', id: publicKey }],
  {
    relays: ['wss://relay.example'],
    authoredLimit: 20,
    parentLimit: 20,
    observationLimit: 100,
    distinctEventLimit: 50,
  },
);
```

Explicit event starts are protected during bounded expansion additions.
Reports expose corpus state before and after the operation, request filters,
relay outcomes, unresolved subjects, completion reason, and bounds reached.

## Process-local JavaScript console

```sh
nostr-research-console --capacity 500
```

The Node REPL keeps one memory and one temporary session alive between
expressions. Top-level `await` is available. The prepared `research` object
provides `acquire`, `events`, `accounts`, `facets`, `traverse`,
`expand`, `replyContexts`, `inspect`, `show`, `use`, `retain`, and collection
helpers. `research.memory` remains the advanced route; there is no workspace
object or database option. `.exit` or Ctrl-D cancels active acquisition and
closes and clears the corpus.

There is deliberately no database format, persistence interface, or reopen
behavior. Retained selections live only while this memory is open. Calling
`reset()` or `close()`, or ending the Node process, loses all resident state.
A fresh process always starts empty.

Removing the remaining Node dependencies (`node:fs`, `node:crypto`, `ws`, and
the Node test and console infrastructure) is a separate future milestone.
