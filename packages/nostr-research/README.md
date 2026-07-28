# Nostr Research

`@nostr-research/memory` is a UI-independent research library for canonical
Nostr evidence. The active runtime is one process-local memory with a renewable
observation buffer, a bounded deliberate evidence archive, and explicit
research knowledge.

The public library uses Web Platform primitives and can be imported in
supported Node and browser-compatible runtimes without Node built-ins or
polyfills. Relay acquisition uses the runtime's standard `WebSocket`.
`jsonl-session.js` and the executable are intentionally Node adapters and are
not imported by the public core.

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
  notebookCapacity: 250,
});
const session = createDeclarativeResearchSession(memory, {
  relays: ['wss://relay.example'],
  acquisition: { timeoutMs: 8000, concurrency: 2 },
  presentation: { previewLimit: 10 },
});

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

`decodeNostrReference(reference)` accepts public `npub`, `nprofile`, `note`,
`nevent`, and `naddr` NIP-19 values, bare or in a `nostr:` NIP-21 URI. It
returns the stable account, event, or address subject, the original reference
and form, and only the author, kind, and relay hints actually encoded. Hints
remain attributed, unverified reference metadata: they never change identity,
session relay defaults, or trigger acquisition. Private `nsec`, unsupported,
malformed, and inputs over NIP-19's 5000-character bound are rejected.
`lookup`, `inspect`, and session `inspect`/`explain` accept these references as
well as subject objects.

Valid NIP-27 `nostr:` references in resident canonical event content derive
distinct `inline-account-reference`, `inline-event-reference`, or
`inline-address-reference` navigation relationships. Their evidence retains
the exact token, content offsets, encoded hints, source event, and observation
provenance. They participate in the existing referenced-account,
referenced-event, and referenced-address moves, but never become conversation
edges or trigger relay acquisition. Invalid, private, unsupported, and
oversized reference-looking text remains ordinary unchanged content.

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
path for a full event, account, or address identity. Address subjects use the
canonical `<kind>:<64-character-lowercase-hex-pubkey>:<d>` coordinate and
resolve to the current locally available replaceable event without changing
the immutable identity of historical event subjects. Collection operations,
continuations, inspection, and notebook inputs all read the same
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

Protocol relationships are derived according to event kind before they enter
the navigation indexes. Kind-1 and kind-1111 thread edges form conversations;
reposts, reactions, and deletion requests retain distinct target
relationships and therefore do not enter reply graphs. Unknown `e`/`E` and
`p`/`P` tags remain mechanical event or account references rather than being
silently assigned thread or mention semantics. `referencedEvents` and
`referencedAccounts` include both typed and mechanical references while the
original canonical tags remain available for inspection. Valid lowercase `a`
tags derive `referenced-address` relationships; NIP-22 `A` roots and `a`
parents retain distinct address relationship types. Move
`events -> referencedAddresses -> currentEvents` for explicit, local,
provenance-preserving address navigation.

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
`extract` turns one relation field into a deduplicated account or event
collection without doing any traversal or relay work. A later `continue` or
`hydrate` command makes that next action explicit. `fetch` reuses ordinary
acquisition; `extract` is a pure local projection.

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

Archive discovery uses `archived` with optional singular `level`, exact
`subject`, and `limit` parameters. It returns the general `subjects` collection
kind even when the bounded result currently contains only events or only
accounts, so the result remains composable with ordinary identity filters and
archive release.

## Named research plans

`executeResearchPlan(memory, plan)` runs a non-empty JSON-serializable array of
named stages. The complete plan is validated before any stage runs. Each stage
has an `id`, one `operation`, plain `parameters`, and an `input` naming an
earlier stage when it consumes or explicitly follows that result. `acquire`
has no input. `select` must explicitly name an earlier `acquire` stage to query
only that acquisition's subjects, or omit `input` and set
`parameters.scope` to `"corpus"` to query the authoritative current resident
corpus.
Plans accept the same normalized research operations as individual session
commands and execute them through the same authoritative executor. Operations
name one earlier `input` or, for operations such as `join`, a named `inputs`
object. A set operation names its left input with `input` and an earlier
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
  { id: 'chosen', operation: 'limit', input: 'notes', parameters: { limit: 20 } },
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

The public core is runtime-neutral. Node streams, process arguments, signals,
and CLI diagnostics remain confined to the JSONL adapter; functional tests
remain Node-based development infrastructure.

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

### Browser Worker adapter

The package also exposes one module Worker entry for browser applications:

```js
const worker = new Worker(
  new URL('@nostr-research/memory/browser-worker', import.meta.url),
  { type: 'module' },
);
```

The exact package-subpath URL construction is resolved by the embedding
application's package tooling. The Worker owns one process-local memory and
one declarative session. Initialize it once before sending research commands:

```json
{"type":"initialize","commandId":"start","memory":{"capacity":500,"archiveCapacity":100,"notebookCapacity":250},"configuration":{"presentation":{"previewLimit":10}}}
```

Successful initialization returns:

```json
{"ok":true,"commandId":"start","sessionRevision":0,"result":{"type":"browser-worker-initialized"},"warnings":[]}
```

Initialization is an adapter lifecycle message, not a declarative research
command. Its `memory` object chooses construction-time capacities and its
optional `configuration` object supplies the initial session configuration.
Invalid or duplicate initialization and commands sent before initialization
return correlated Worker lifecycle errors.

After initialization, send the ordinary command objects documented below.
The Worker processes messages sequentially and posts each existing session
response object unchanged. A `close` command retains normal session
cancellation and closure behavior, but does not terminate the Worker; the
embedding application owns `worker.terminate()`. Later commands receive the
session's ordinary `SESSION_CLOSED` response. The adapter adds no runtime
capabilities to commands, schemas, provenance, or session state.

Research commands include source operations, subject-collection transforms,
relation operations, explicit archive and notebook operations, and `plan`.
`schema` without an input reports a compact global vocabulary and
configuration. Request `{ "detail": "full" }` when the exhaustive parameter
contracts are needed. `schema` with a named input and empty parameters reports
that handle's structure and complete compatible-operation inventory without
duplicating every operation contract:

```json
{"commandId":"full-schema","command":"schema","parameters":{"detail":"full"}}
```

```json
{"commandId":"authors-schema","command":"schema","input":"authors","parameters":{}}
```

Select one operation to receive its detailed contract, populated field
candidates, effective session defaults, and caller choices still required:

```json
{"commandId":"authors-scan","command":"schema","input":"authorsRows","parameters":{"operation":"scan"}}
```

Contextual schema reports facts rather than inventing a research direction. It
does not arbitrarily choose fields, predicates, search terms, relationships,
or subjects. Known empty fields remain visible in the handle structure, while
focused operation details identify populated candidates separately. Individual
operations accept plain JSON `parameters`, either an
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
Contextual schema adds actual available and populated fields, effective
external-operation defaults, and caller choices still required.
`compatibleOperations` is the exhaustive operation inventory for the handle;
focused schema supplies the selected operation's details.

Relation transformations retain lightweight field lineage when a field is
renamed or used as an aggregation key. This allows later operations such as
`extract` to recognize account or event identifiers without guessing from the
new field name. A `derive` field inherits lineage and its known subject type
only when its expression is a bare field reference; constants and every
computed expression remain untyped, regardless of their resulting strings.
Technical fields are reported separately in relation structure, and
row-specific truncation details appear under `fieldMetadata` rather than as
ordinary analysis columns.

Acquisition and hydration handles retain their external-operation accounting
while exposing their embedded stable subject collection to ordinary collection
operations. A caller may therefore `relate`, navigate, preserve, or continue
directly from such a handle. `select` remains available when the caller wants
to apply event-query constraints within one acquisition attempt; it is not a
mandatory conversion step.

Hydration completeness counts requested, resolved, and missing account
subjects. The hydration handle itself counts immutable metadata events, so its
cardinality can be larger when relays return multiple metadata events for one
account. Archive summaries make the inverse distinction explicit: archive
entry presence is reported separately from canonical evidence resolution,
because reference and excerpt preservation do not retain complete canonical
evidence.

Configuration has explicit levels. Engine constraints are immutable supported
ranges. Memory, archive, and notebook capacities are construction-time
configuration because changing them can evict or reject stored state. Session
configuration supplies defaults for future relay acquisition and bounded
presentation. Per-command parameters override those defaults for one command.
The `schema` command reports constraints and effective configuration; `status`
reports the effective runtime configuration.

`relay-info` is the explicit NIP-11 inspection operation. It takes normalized
`wss://` relay URLs (or session relay defaults), converts each to the same host
and path over HTTPS, and uses the runtime's standard `fetch` with
`Accept: application/nostr+json`. Timeout and concurrency are command bounds;
document bytes and retained values have engine bounds. The result is a
nameable `relay-information` handle with one attributed outcome per relay:

```jsonl
{"commandId":"relay-info","command":"relay-info","parameters":{"relays":["wss://relay.example/path"],"timeoutMs":5000,"concurrency":2},"resultId":"relay-advertisements"}
{"commandId":"coverage","command":"show","input":"relay-advertisements","parameters":{"mode":"coverage"}}
```

Its supported observations are `summary`, `preview`, `coverage`, and
`details`. It is neither a subject collection nor acquisition coverage.
Advertised NIPs, limitations, and `advertisedAuthRequired` remain relay claims;
they do not establish observed support, trust, quality, or an authentication
refusal. Ordinary acquisition never performs this HTTP request.

`relay-count` explicitly sends one NIP-45 count request for one normalized
filter to each selected relay (or the session relay defaults):

```jsonl
{"commandId":"count","command":"relay-count","parameters":{"filter":{"kinds":[1]},"relays":["wss://relay.example"],"timeoutMs":5000,"concurrency":2},"resultId":"relay-counts"}
{"commandId":"preview","command":"show","input":"relay-counts","parameters":{"mode":"preview"}}
```

The ephemeral `relay-count` handle supports `summary`, `preview`, `coverage`,
and `details`. Exact and approximate responses, HLL evidence, notices,
refusals, transport failures, and bounds stay attributed per relay. Summaries
count outcome categories but never sum event counts across overlapping relay
corpora. Counting does not fetch NIP-11 information or mutate research memory.

Session defaults can be updated without rewriting memory:

```json
{"commandId":"configure","command":"configure","parameters":{"relays":["wss://relay.example"],"acquisition":{"timeoutMs":8000,"observationLimit":200,"distinctEventLimit":150,"concurrency":2},"presentation":{"previewLimit":10,"excerptLimit":240,"sizeLimit":20000}}}
```

The precedence is per-command parameters, session configuration, engine
defaults, then immutable hard constraints. Generic configuration deliberately
cannot resize memory or silently evict evidence.

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
handle, structured external completeness and corpus effects where relevant,
and warnings. They do not embed evidence previews. `show` gives
observation five explicit meanings: `preview` is a bounded member/row page,
`summary` is compact counts and characteristics, `coverage` reports sources,
bounds, omissions, unresolved evidence, and partiality, `details` resolves
currently known canonical evidence for the selected page, and `explain`
reports the selected page's membership reasons and provenance. `inspect`
remains the direct exact-subject evidence view and `explain` the direct
exact-subject membership view.

`show` reports only the requested evidence view. It does not recommend a next
operation or imply a research workflow. Summary context keeps the operation,
bounds, and compact lineage while replacing potentially large selection values
with counts; canonical evidence and detailed membership provenance remain
available through `inspect`, `details`, and `explain`. Contextual `schema`
reports the structure and compatible operations for a named handle; the
researcher decides which action, if any, to take.

Relation previews omit bulky source-evidence fields such as complete tag,
link, domain, and account-description values and report their names in
`omittedValueFields`. The underlying relation remains unchanged. Request
`details` or `includeEvidence` when those values and canonical subject evidence
are needed.

### Sequential session walkthrough

Start one process and send these lines in order (each response is one bounded
JSON line):

```jsonl
{"commandId":"acquire","command":"acquire","parameters":{"relays":["wss://relay.example"],"filter":{"kinds":[1],"limit":20},"timeoutMs":5000,"observationLimit":30,"distinctEventLimit":20,"concurrency":2},"resultId":"attempt"}
{"commandId":"select","command":"select","input":"attempt","parameters":{"kinds":[1],"limit":20},"resultId":"notes"}
{"commandId":"preview","command":"show","input":"notes","parameters":{"mode":"preview","previewLimit":5}}
{"commandId":"choose","command":"pick","input":"notes","parameters":{"positions":[1,3]},"resultId":"chosen"}
{"commandId":"rows","command":"relate","input":"chosen","parameters":{},"resultId":"evidence"}
{"commandId":"authors","command":"aggregate","input":"evidence","parameters":{"by":[{"field":"event.author","name":"account"}],"aggregations":[{"name":"noteCount","operation":"count"}]},"resultId":"authors"}
{"commandId":"accounts","command":"extract","input":"authors","parameters":{"field":"account","subjectType":"account","limit":20},"resultId":"accounts"}
{"commandId":"why","command":"show","input":"accounts","parameters":{"mode":"explain","previewLimit":5}}
```

The acquisition may succeed with `external.status: "partial"`; its
`external.completeness` says which bounds or relay outcomes made it partial.
Per-relay coverage distinguishes a connection that never opened, an opened
peer that closed early, an explicit `CLOSED` refusal, and EOSE completion.
Coverage also retains up to ten bounded `NOTICE` texts (with an omission
count), a neutral observed `AUTH` challenge, standardized `CLOSED` reason
categories with bounded raw text, and recognized NIP-67 `finish`/`more` EOSE
hints. An `AUTH` challenge is evidence only: the library neither answers it
nor changes an otherwise successful read into `auth-required`. That outcome
exists only when a relay sends an `auth-required:` `CLOSED` reason.
Observation does not change `sessionRevision`. Each command names every input
and output, so there is no active selection or background pipeline.

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
`referenced-events`, `conversation`, `shared-tags`, or `linked-domains`.
`source` is `local` (the default), or `relays` for relationships advertised
with relay support by `schema`; `shared-tags` and `linked-domains` are local
only. Relay continuations use explicit per-command `relays` when supplied,
otherwise the session's configured relay defaults. They accept time,
observation, distinct-event, and concurrency bounds. Both forms report
completeness and per-input omissions, while
`explain` exposes the continuation relationship responsible for membership.
The response includes a bounded `outcomes` window with each input subject's
status and contribution count. When a bound or partial relay attempt affects
particular inputs, `sequentialRetry` identifies those subjects and the original
input handle so the caller can retry them one at a time.
An input status of `matched` means that the relationship produced at least one
candidate; it does not claim that every candidate's canonical evidence is
resident. `show` and `inspect` report evidence resolution separately.
`attemptStatus` reports whether that particular local or relay projection
completed, `dataScope` identifies `resident-corpus` or
`bounded-relay-attempt`, and `exhaustive` remains separate. Relay completeness
therefore never implies that the relay's total data is exhaustive.

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
`omittedBefore`, and `omittedAfter`. When response size reduces the requested
window, `sizeBounded`, `requestedItems`, `returnedItems`, and `boundReason`
make that reduction explicit. Responses report counts plus `omitted`
or truncation metadata rather than emitting unbounded values. When a byte
bound is reached, secondary provenance is removed before requested preview
evidence.

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
reports scope, bounds, corpus pressure and eviction effects, and warnings.
Detailed relay and observation coverage is
available explicitly with `show` and `mode: "coverage"`; each list is bounded
by `previewLimit` and reports omitted counts.

Sustained field use has exercised this single executable flow across
goal-directed account research and open-ended event exploration, including
complete buffer turnover. Ordinary analysis required no executable JavaScript:
schema discovery, named handles, subject navigation, relations, and explicit
local or relay-backed operations supplied the needed composition.
