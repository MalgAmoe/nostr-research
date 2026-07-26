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
session.activate(notes);
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
selection operation. `lookup(subject)` is the direct exact-subject selection
path for a full event or account identity. Account resolution, `searchAccounts`, `currentEvent`,
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
received packets, invalid events, canonical events that did not match the
exact requested NIP-01 filter, accepted and duplicate observations, distinct
acquired events, newly stored corpus events, the stopping bound, provenance,
complete attempt coverage, and corpus changes. Non-matching events are not
ingested and consume neither budget. Unknown acquisition options are rejected
before relay contact. Attempt coverage is returned directly; the corpus does
not keep a global acquisition history.
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
Observation and distinct-event limits apply across the complete composed
operation; an event ID returned again by a later nested request is counted only
once against the composed distinct-event limit.

## Local collection algebra

`memory.transform(collection, stages)` applies a fully JSON-serializable local
plan. Supported stage operations are `filter`, `group`, `summarize`, and
`move`; the complete typed path is checked before the first stage runs. Stages
may carry an `as` name and always record their normalized description in the
result context. Defaults and caller limits bound group counts, members,
summaries, samples, and collected values.

```js
const evidence = memory.transform(memory.select({ kinds: [1] }), [
  {
    operation: 'filter',
    as: 'image notes excluding one author',
    where: {
      all: [
        { field: 'event.hasMedia', equals: true },
        { not: { field: 'event.author', equals: unwantedPublicKey } },
      ],
    },
  },
  { operation: 'group', as: 'balanced authors', by: 'event.author', itemLimit: 3 },
  {
    operation: 'summarize',
    aggregations: [
      { name: 'count', operation: 'count' },
      { name: 'examples', operation: 'sample', field: 'subject', limit: 2 },
      { name: 'domains', operation: 'collect', field: 'event.linkedDomain', limit: 10 },
    ],
  },
]);
```

Filter predicates compose with `all`, `any`, and `not`. Group keys cover
subjects, author, kind, structured tag, linked domain, and observed relay.
Explicit summary aggregations are `count`, `distinct`, `sample`, `collect`,
`min`, and `max`. Move routes cover event authors and protocol references,
resident authored events, and current kind-3 follows. These transforms never
acquire, hydrate, retain, or evict evidence.

## Process-local JavaScript console

```sh
nostr-research-console --capacity 500
```

The Node REPL keeps one memory and one explicit active selection alive between
expressions. Top-level `await` is available. Query and analysis operations
return values and never replace the active selection: `acquire`, `events`,
`accounts`, `currentEvent`, `follows`, `expand`, `replyContexts`, `traverse`,
`connections`, `exclude`, `distinctBy`, `limitPer`, `discoveries`, `facets`, `compare`,
`inspect`, `project`, `hydrate`, `annotate`, `annotated`, `removeAnnotation`, and `show`.
`traverse(result, options)` always traverses the supplied
result without changing active state.

Annotations are process-local interpretations attached to stable subjects. They
contain only caller-defined labels and a free-text note; the library assigns no
universal status or credibility meaning to them. `annotated(query)` returns a
normal result collection that composes with traversal, expansion, retention,
and projection.

```js
const connected = research.connections(seeds, {
  relationshipTypes: ['follow'],
  minimumSources: 2,
});
await research.hydrate(connected, { relays, kinds: [0] });
research.annotate(connected.items[0].subject, {
  labels: ['keep'],
  note: 'Inspect this account again',
});
```

State changes have separate, plainly named operations:

```js
const notes = research.events({ kinds: [1], text: ['nostr'] });
const related = research.traverse(notes, {
  relationshipTypes: ['reply-parent'],
  direction: 'outbound',
  depth: 1,
  limit: 50,
});

research.activate(related);
const savedResult = research.retain(notes, 'search result');
research.activate(savedResult); // retained summary or memory.getSet(savedResult.id)
const savedActive = research.checkpoint('active investigation');
```

`activate(result)` is the only operation that replaces the active selection.
It accepts ordinary result collections, retained summaries returned by
`retain()`, and full retained selections returned by `memory.getSet()`.
Reactivation restores retained subjects and reasons; an evicted event remains
an unresolved subject reference and is not recreated.
Result collections retain stable subject identities, roles, and reasons rather
than treating embedded canonical records as collection identity. Operations
resolve current event evidence, account metadata, and provenance from the
resident corpus. Thus later observations or replacement metadata do not stale
a collection, while eviction leaves an inspectable nonresident reference.
The current value is available read-only as `research.activeSelection`.
`retain(result, name, options)` retains an explicit value, while
`checkpoint(name, options)` retains the active selection. `summary()` returns
one authoritative `corpus` description plus an `activeSelection` summary.
`inspect(subject)` returns raw orientation and evidence information without
presentation options. Bounded presentation and detailed evidence options
belong to `show(value, options)`.
Compact `show` output summarizes reasons; `show(value, {
includeEvidence: true })` exposes detailed reasons, provenance, and evidence.
`research.memory` remains the advanced route; there is no workspace object or
database option. `.exit` or Ctrl-D cancels active acquisition and closes and
clears the corpus.

There is deliberately no database format, persistence interface, or reopen
behavior. Retained selections live only while this memory is open. Calling
`reset()` or `close()`, or ending the Node process, loses all resident state.
A fresh process always starts empty.

Removing the remaining Node dependencies (`node:crypto`, `ws`, and the Node
test and console infrastructure) is a separate future milestone.
