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
pipeline. Supported stage operations are `filter`, `project`, `distinct`,
`sort`, `limit`, `sample`, `group`, `summarize`, `move`, `union`,
`intersection`, `difference`, and `compare`; the complete typed path is checked
before the first stage runs. Stages may carry an `as` name and always record
their normalized description in the result context. Cardinality-changing
stages report their input, output, omitted count, and truncation state.
Defaults and caller limits bound groups, members, projections, summaries,
samples, and collected values.

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

Sorting is stable. Sampling ranks stable subject identities with an explicit
seed (or the documented default), so the same input and seed produce the same
bounded result. Set operations accept another compatible subject collection in
`with`, merge reasons and provenance by stable subject identity, and reject
different collection kinds during preflight. `compare` returns concise
left/right/shared counts.

`memory.describeCollectionPipeline()` (also exported as
`collectionPipelineSchema()`) returns the operation, field, bound, and ordering
schema as plain data. The declarative/JSONL session exposes the same value with
the read-only `schema` command. Account profile fields are literal:
`account.name` reads only `name`, while `account.display_name` reads only
`display_name`.

## Named research plans

`executeResearchPlan(memory, plan)` runs a non-empty JSON-serializable array of
named stages. The complete plan is validated before any stage runs. Each stage
has an `id`, one `operation`, plain `parameters`, and an `input` naming an
earlier stage when it consumes or explicitly follows that result. `acquire`
has no input. `select` must explicitly name an earlier `acquire` stage to query
only that acquisition's subjects, or omit `input` and set
`parameters.scope` to `"corpus"` to query the authoritative current resident
corpus.
The supported local pipeline operations are the same ones accepted by
`memory.transform`; plans additionally support `acquire`, `select`, `hydrate`,
and `retain`. A set operation names its left input with `input` and an earlier
compatible right-hand stage with `parameters.with`.

```js
const report = await executeResearchPlan(memory, [
  {
    id: 'orientation',
    operation: 'acquire',
    parameters: {
      relays,
      filter: { kinds: [1], limit: 50 },
      timeoutMs: 10_000,
      observationLimit: 75,
      distinctEventLimit: 50,
    },
  },
  {
    id: 'notes',
    operation: 'select',
    input: 'orientation',
    parameters: { kinds: [1], limit: 50 },
  },
  {
    id: 'chosen',
    operation: 'filter',
    input: 'notes',
    parameters: {
      where: { field: 'event.tag', name: 't', value: chosenTag },
      limit: 20,
    },
  },
  {
    id: 'authors',
    operation: 'move',
    input: 'chosen',
    parameters: { to: 'authors', limit: 10 },
  },
  {
    id: 'profiles',
    operation: 'hydrate',
    input: 'authors',
    parameters: {
      relays,
      kinds: [0],
      timeoutMs: 10_000,
      observationLimit: 20,
      distinctEventLimit: 20,
    },
  },
  {
    id: 'saved',
    operation: 'retain',
    input: 'authors',
    parameters: {
      name: suppliedName,
      options: { reason: suppliedReason },
    },
  },
]);
```

The returned `research-plan-report` includes the normalized complete plan and
each stage result plus a concise `resultKind`. Acquisition and hydration return
their existing bounded completion reports and never replace an input
collection, so a later stage can explicitly reuse the pre-hydration account
stage. The runner infers no topics, exclusions, examples, names, or reasons,
and does not activate session state or persist plans. A retained plan reason,
when supplied, is an object with a non-empty `type`; invalid plan data is
rejected before any external stage runs.

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
Collection `show` output also includes a bounded `orientation` projection:
population by subject type, preview ordering and omission metadata, observation
freshness, corpus pressure and nonresident subjects, retained memberships,
top and long-tail facets, and conversation relationship counts. These are
reproducible descriptions of the supplied result, not rankings or conclusions.
Membership evidence is reported separately from resident canonical evidence,
so an account derived from authored notes remains explainable without implying
that profile metadata is resident. Conversation counts use collection edges
when available and otherwise use the relationship reasons preserved on members.
`show(compare(left, right))` reports shared and side-only populations with
bounded previews for compatible result kinds.
`research.memory` remains the advanced route; there is no workspace object or
database option. `.exit` or Ctrl-D cancels active acquisition and closes and
clears the corpus.

There is deliberately no database format, persistence interface, or reopen
behavior. Retained selections live only while this memory is open. Calling
`reset()` or `close()`, or ending the Node process, loses all resident state.
A fresh process always starts empty.

Removing the remaining Node dependencies (`node:crypto`, `ws`, and the Node
test and console infrastructure) is a separate future milestone.

## JSON Lines session protocol

```sh
nostr-research-session --capacity 500
```

The executable owns one persistent declarative research session. It reads one
JSON command from each non-empty UTF-8 line and writes exactly one JSON response
line to stdout. EOF closes the corpus; `SIGINT` and `SIGTERM` cancel owned
external work before shutdown. Startup diagnostics use stderr. There are no
prompts or progress messages on stdout.

Every command has a non-empty string `commandId` and a `command`. A response is
either:

```json
{"ok":true,"commandId":"notes","sessionRevision":1,"result":{},"warnings":[]}
{"ok":false,"commandId":"notes","sessionRevision":1,"error":{"code":"INVALID_OPERATION","message":"...","details":{}}}
```

Malformed JSON cannot provide trustworthy correlation, so its response uses
`commandId: null` and `INVALID_COMMAND`. Optional `ifRevision` rejects stale
commands with `REVISION_CONFLICT`. Revisions advance when corpus, retained-set,
or named-handle state changes; observation commands and failed commands do not
advance them.

Research commands are `acquire`, `select`, `filter`, `group`, `summarize`,
`move`, `hydrate`, `continue`, `retain`, and `plan`. Single operations accept plain JSON
`parameters`, optional `input`, and optional `resultId`; `replace: true`
explicitly replaces an existing named result. Plans accept the documented
research-plan array and an optional `outputs` map from stage IDs to result IDs.
They use the same operation interpreter as in-process callers.

`select` always makes its scope explicit. With an acquisition result as
`input`, it selects only among that attempt's stable event subjects (and may
set `scope: "acquisition"`). Without an input it must set
`scope: "corpus"` to query all currently resident evidence. Reusing a
`resultId` requires `replace: true`; replacement advances that working handle
without deleting or rewriting corpus evidence.

`continue` turns a named subject handle directly into the next bounded result.
Its `relationship` is one of `authored-notes`, `profiles`, `follow-lists`,
`followed-accounts`, `followers`, `replies`, `ancestors`, `mentions`, `quotes`,
`referenced-events`, `conversation`, `shared-tags`, `linked-domains`, or
`expansion`. `source` is `local` (the default) or `relays`; relay continuations
also require explicit `relays` and accept time, observation, distinct-event,
and concurrency bounds. Both forms report completeness and per-input
omissions, while `explain` exposes the continuation relationship responsible
for membership. Relay completeness describes only the bounded attempt.

Observation commands are `show`, `inspect`, `explain`, `list`, `status`, and
`schema`.
`show` and `explain` consume a named input. `inspect` receives its stable
`subject` in `parameters`. Projection parameters are `previewLimit`,
`excerptLimit`, `includeEvidence`, and `sizeLimit`; `show` additionally accepts
`mode`. Responses report counts plus `omitted` or truncation metadata rather
than emitting unbounded values.

Lifecycle commands are `release`, `reset`, and `close`, with empty
`parameters`. `release` removes only its named handle. `reset` clears handles
and all process-local memory. `close` also ends the session. Empty and partial
external results remain successful responses. Their concise default envelope
reports scope, bounds, corpus pressure and eviction effects, a bounded preview,
bounded facets, and warnings. Detailed relay and observation coverage is
available explicitly with `show` and `mode: "coverage"`; each list is bounded
by `previewLimit` and reports omitted counts.
