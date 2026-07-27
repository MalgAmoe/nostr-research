# Nostr Research

`@nostr-research/memory` is a UI-independent research library for canonical
Nostr evidence. The active runtime is one process-local memory with a renewable
observation buffer, a bounded deliberate evidence archive, and explicit
research knowledge.

The product path has four layers: memory owns the observation buffer, evidence
archive, research notebook, and only the indexes needed to retrieve that
state; the authoritative executor produces collection/relation values and
per-attempt acquisition reports from explicit inputs; the declarative session
owns names for those engine values; and the JSON Lines executable adapts those
commands for persistent process use. Handles are not corpus storage.

```js
import {
  acquireRelayEvents,
  createDeclarativeResearchSession,
  createInMemoryResearchMemory,
} from '@nostr-research/memory';

const memory = createInMemoryResearchMemory({
  capacity: 500,
  archiveCapacity: 100,
});
const session = createDeclarativeResearchSession(memory);

memory.ingest(event, {
  relay: 'wss://relay.example',
  observedAt: new Date().toISOString(),
});

const notes = memory.select({ kinds: [1], text: ['nostr'] });
await session.close(); // clears all resident state
```

`ingest` stores immutable canonical evidence and records each observation in
the observation buffer. Buffer capacity uses deterministic FIFO eviction.
`describe()` reports separate observation-buffer, archive, and notebook
capacity and counts; it does not duplicate buffer state under a legacy corpus
shape. Eviction removes buffer evidence and its derived indexes, while notebook
entries and named membership keep stable subject references.
`inspect(subject)` reports `resolutionSource` as
`"archive"`, `"buffer"`, or `"unresolved"`.

Evidence survives buffer turnover only through an explicit preservation
operation:

```js
const selected = memory.select({ ids: [event.id] });
memory.preserve(selected, {
  level: 'canonical', // or "excerpt" / "reference"
  reason: { type: 'research-anchor' },
});

memory.archived({ level: 'canonical' });
memory.releaseEvidence([{ type: 'event', id: event.id }]);
```

Reference entries preserve identity and reason only. Excerpts are visibly
non-canonical bounded snapshots. Canonical entries preserve the unmodified
event and selected observation provenance. A full archive rejects the whole
preservation request; acquisition never evicts archive entries.

Local operations never contact relays. `select` is the canonical local event
selection operation. `lookup(subject)` is the direct exact-subject selection
path for a full event or account identity. Collection operations,
continuations, inspection, facets, and notebook inputs all read the same
memory. A collection contains stable subjects, reasons, and provenance
references, not a hidden copy of canonical evidence.

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

## Local collection algebra

Collection operations run behind the same executor used by plans and session
commands. The direct `memory.transform(collection, stages)` entry is a
convenience over that engine behavior. Supported stages are the identity-only `filter` (on `subject.type`
or `subject.id`), `pick`, `limit`, `sample`, `move`, `union`, `intersection`,
`difference`, and `compare`. Use `relate` to cross into value analysis, then
use relation `filter`, `project`, `distinct`, `sort`, `slice`, and `aggregate`.

`pick` keeps explicit one-based positions from the current stable collection
order. It is useful after a bounded `show` preview: the caller can select the
visible items without copying identifiers or writing JavaScript. A position
outside the current collection fails instead of silently selecting a different
item.

```js
const notes = memory.transform(memory.select({ kinds: [1] }), {
  operation: 'filter',
  where: { field: 'subject.type', equals: 'event' },
});
```

Collection filtering deliberately does not inspect evidence fields. Move
routes cover event authors and protocol references,
resident authored events, and current kind-3 follows. These transforms never
acquire, hydrate, remember, or evict evidence.

## Composable research relations

Subject collections enter the general relation algebra with `relate`.
Relations retain stable subjects, bounded derived values, reasons, provenance
references, and references to source-backed fields. Source fields resolve
through the current archive or observation buffer when an operation or
projection needs them; a handle therefore reports `archive`, `buffer`, or
`unresolved` as evidence lifetime changes instead of retaining a stale source
snapshot. They support `filter`, `project`, `distinct`,
`sort`, `limit`, `join`, `aggregate`, `derive`, `slice`, `explode`, `scan`,
and `balance`. Unlike the older group and summary shapes, every relation
remains usable by later relation operations.

`explode` turns every element of an array-valued field into a row while
preserving its evidence. The element is written to `as`, its source position
to `indexAs`, and array elements are also exposed numerically. Exploding
`event.tags` as `tag`, for example, exposes `tag.0`, `tag.1`, and so on.
Related event fields include extracted `event.links`, `event.domains`, and
`event.hasMedia`. Media presence is derived from attributed media metadata,
media MIME tags, recognized media URL extensions, and known media hosts.

`scan` searches a caller-selected vocabulary across several fields and emits
`match.field`, `match.term`, `match.sourceSubject`, a bounded `match.excerpt`,
and match coordinates. `matchMode` is explicitly `substring`, `word`, or
`phrase`; `match` separately controls whether any or all supplied terms must
occur. A match emits one row per matching field and term, and `limit` is a
global emitted-row bound. Relation observation reports row count, distinct
subject count, and distinct event-author count separately. It does not retain the unlimited original field and
performs mechanical matching only; it does not classify the result.
Relation `sample` and `collect` aggregations return retained values together
with explicit input, retained, omitted, and truncation counts. `balance`
retains at most `limitPer` rows for each selected key,
so one prolific author cannot consume an evidence window.

Plans may give a stage one `input` or a named `inputs` object. `join` uses
`inputs: { left, right }`, so combining evidence is no longer restricted to
same-kind set membership. Derived expressions are bounded JSON data rather
than executable JavaScript.

Individual declarative-session commands accept the same `input` or `inputs`
forms. A direct interactive join can therefore name two existing handles:

```json
{"commandId":"join-1","command":"join","inputs":{"left":"evidence","right":"profiles"},"parameters":{"on":{"left":"account","right":"event.author"},"kind":"left","select":[{"field":"account.name","name":"name"}]},"resultId":"candidates"}
```

`fetch` builds a bounded relay filter from relation fields. For example,
`bindings: { authors: "account" }` acquires events authored by the distinct
account values in its input rows and reports the number of values bound.
`expand` turns a relation field into account or event subjects and follows a
named protocol relationship locally or through bounded relay acquisition.
Both reuse the ordinary acquisition and continuation implementations.

Local and relay-backed continuation accepts `offset` and `eventLimit`.
Multi-input projection visits each explicit input in turn before taking
additional results from a prolific input; `eventLimit` remains one observable
global result bound. Together with relation `slice`, this makes truncation navigable instead of
silently fixing every relationship projection to its first window.

```js
const report = await executeResearchPlan(memory, [
  { id: 'notes', operation: 'select', parameters: { scope: 'corpus', kinds: [1] } },
  { id: 'rows', operation: 'relate', input: 'notes', parameters: {} },
  {
    id: 'authors',
    operation: 'aggregate',
    input: 'rows',
    parameters: {
      by: [{ field: 'event.author', name: 'account' }],
      aggregations: [
        { name: 'noteCount', operation: 'count' },
        { name: 'examples', operation: 'sample', field: 'event.text', limit: 2 },
      ],
    },
  },
  {
    id: 'window',
    operation: 'slice',
    input: 'authors',
    parameters: { offset: 20, limit: 20 },
  },
]);
```

An account-evidence view is deliberately a composition rather than a special
account-research task:

```js
const accountEvidence = await executeResearchPlan(memory, [
  { id: 'notes', operation: 'select', parameters: { scope: 'corpus', kinds: [1] } },
  { id: 'note-rows', operation: 'relate', input: 'notes', parameters: {} },
  {
    id: 'evidence', operation: 'aggregate', input: 'note-rows',
    parameters: {
      by: [{ field: 'event.author', name: 'account' }],
      aggregations: [
        { name: 'noteCount', operation: 'count' },
        { name: 'examples', operation: 'sample', field: 'event.text', limit: 3 },
        { name: 'domains', operation: 'collect', field: 'event.domains', limit: 5 },
      ],
    },
  },
  {
    id: 'profile-events', operation: 'fetch', input: 'evidence',
    parameters: {
      relays,
      filter: { kinds: [0], limit: 200 },
      bindings: { authors: 'account' },
      timeoutMs: 10_000,
      observationLimit: 300,
      distinctEventLimit: 200,
      concurrency: 2,
    },
  },
  { id: 'profiles', operation: 'relate', input: 'profile-events', parameters: {} },
  {
    id: 'accounts', operation: 'join',
    inputs: { left: 'evidence', right: 'profiles' },
    parameters: {
      kind: 'left',
      on: { left: 'account', right: 'event.author' },
      select: [
        { field: 'account.name', name: 'name' },
        { field: 'account.description', name: 'description' },
        { field: 'account.nip05', name: 'nip05' },
      ],
    },
  },
]);
```

The same composition works interactively with named session handles.
Graph-derived rows can be joined as another evidence source, preserving their
subjects, reasons, and provenance as path evidence.

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
and the notebook operations `remember`, `notebook`, and `remember-membership`.
A set operation names its left input with `input` and an earlier
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
    operation: 'remember-membership',
    input: 'authors',
    parameters: {
      name: suppliedName,
      reason: suppliedReason,
    },
  },
]);
```

The returned `research-plan-report` includes the normalized complete plan and
each stage result plus a concise `resultKind`. Acquisition and hydration return
their existing bounded completion reports and never replace an input
collection, so a later stage can explicitly reuse the pre-hydration account
stage. The runner infers no topics, exclusions, examples, names, or reasons,
and does not update declarative session handles or persist plans. A membership reason,
when supplied, is an object with a non-empty `type`; invalid plan data is
rejected before any external stage runs.

There is deliberately no database format, persistence interface, or reopen
behavior. Notebook knowledge lives only while this memory is open. Calling
`reset()` or `close()`, or ending the Node process, loses all resident state.
A fresh process always starts empty.

Removing the remaining Node dependencies (`node:crypto`, `ws`, and the Node
test infrastructure) is a separate future milestone.

## JSON Lines session protocol

```sh
nostr-research-session --capacity 500
```

This is the sole product research-session model. The executable owns one
persistent declarative research session. It reads one
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
commands with `REVISION_CONFLICT`. Revisions advance when the corpus, notebook,
archive, or named-handle state changes; observation commands and failed commands do not
advance them.

Research commands include source operations, subject-collection transforms,
relation operations, explicit archive and notebook operations, and `plan`; `schema` reports the authoritative
current list. Individual operations accept plain JSON `parameters`, either an
optional `input` or named `inputs`, and optional `resultId`; `replace: true`
explicitly replaces an existing named result. Named inputs are primarily used
by `join`, with `{ "left": "...", "right": "..." }`. Plans accept the documented
research-plan array and an optional `outputs` map from stage IDs to result IDs.
They use the same operation interpreter as in-process callers.

The package exports `normalizeResearchOperation`,
`preflightResearchOperation`, and `executeResearchOperation` for direct
single-operation use. Plans and sessions call these same functions rather than
reconstructing operation rules. `operationSchema()` and the session `schema`
command are derived from the same definitions; each definition reports its
accepted input shape, output and result kinds, locality (`local`, `external`,
or `by-source`), memory mutation owner, and completeness contract.

Subject collections remain the identity and navigation representation.
`pick`, `sample`, `move`, and set composition are collection-specific.
Relations remain the value-analysis representation. `project`, `distinct`,
`sort`, and `aggregate` are relation-only, and relation windows use `slice`.
The only shared name is `filter`: collections accept identity fields only,
while relations filter row values. This intentional boundary lets mixed
subject collections refine their identity kind before navigation without
reintroducing evidence-field analysis in collections.

`hydrate` and `continue` with relationship `profiles` share the same bounded
relay-acquisition accounting and buffer-mutation contract. `hydrate` is the
direct profile-event form; `continue` is the relationship form and additionally
supports local resolution. Neither performs an implicit second relay request.

Research commands return compact operational results by default: the named
handle, bounded external-completeness and corpus effects where relevant, and
warnings. They do not embed evidence previews or facets. Use `show` for a
bounded summary or preview, `inspect` for current subject evidence, and
`explain` for result membership reasons.

The research notebook owns provisional judgments, notes, bounded summaries,
and named subject membership. `remember` applies an attributed entry with a
reason and stable source references to each subject in its input; `notebook`
queries judgments or labels into an ordinary collection; `forget` removes
entries. `remember-membership` records an explainable named candidate group.
Nothing is recorded automatically and notebook actions never archive evidence.

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

Observation commands are `show`, `inspect`, `explain`, `list`, `memberships`, `membership`,
`status`, and `schema`.
`show` and `explain` consume a named input. `inspect` receives its stable
`subject` in `parameters`. Projection parameters are `previewLimit`,
`excerptLimit`, `includeEvidence`, and `sizeLimit`; `show` additionally accepts
`mode` and `offset`. Relation previews show bounded values and evidence counts by default;
`includeEvidence: true` adds bounded subject and provenance-reference details.
`offset` selects another preview window without creating a new result.
Collection, relation, acquisition, typed-collection, and plan previews return
their effective `offset`, `limit`, `nextOffset`,
`omittedBefore`, and `omittedAfter`; `sizeBounded` and `sizeOmitted` identify
rows omitted to satisfy the byte bound. Responses report counts plus `omitted`
or truncation metadata rather than emitting unbounded values. When a byte
bound is reached, optional facets, orientation details, and provenance are
removed before the requested preview evidence.

`status` exposes observation-buffer pressure and evictions, archive entries by
preservation level, notebook entry and membership counts, and the total handle
count. `list` exposes each named handle's kind and cardinality. Together these
report evidence resolution separately as `buffer`, `archive`, and `unresolved`,
and count named notebook memberships separately from notebook judgments. This
makes renewable evidence, deliberate evidence, research knowledge, and working
views observable without presenting one store as another.

Handle lifecycle commands are `release` and `release-all`; neither deletes
notebook knowledge. Named membership is listed with `memberships`, inspected
with `membership`, and changed by another `remember-membership` using the same name or
`delete-membership`. Releasing archived evidence and deleting notebook
knowledge are likewise independent. Ordinary `resultId` replacement still
requires `replace: true`.

`reset` clears handles and all process-local memory. `close` also ends the
session. Empty and partial
external results remain successful responses. Their concise default envelope
reports scope, bounds, corpus pressure and eviction effects, a bounded preview,
bounded facets, and warnings. Detailed relay and observation coverage is
available explicitly with `show` and `mode: "coverage"`; each list is bounded
by `previewLimit` and reports omitted counts.
