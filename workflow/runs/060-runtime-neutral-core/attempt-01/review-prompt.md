# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
repository source, deliverables, task state, or workflow records. Do not repair
the work. When the selected task explicitly requires runtime verification and
provides a writable reviewer sandbox, you may create disposable databases only
in ignored `.data/` paths or the system temporary directory.

The first non-empty line of your response must be exactly one of:

- `PASS`
- `CHANGES_REQUIRED`
- `BLOCKED`

Use `PASS` only when all acceptance criteria are materially satisfied.

Treat the durable principles in `CONTEXT.md` as constraints on every task.
Historical completed tasks do not override current policy. Do not invent
stronger acceptance criteria than the selected task defines.

Audit test changes as carefully as production changes:

- Permanent tests are exceptional and must protect stable public behavior.
- Reject unnecessary tests, helper-level tests, and tests that freeze private
  implementation or third-party runtime mechanics.
- Reject tests of TCP, TLS, WebSocket-library behavior, process scheduling, or
  exact timing unless the selected task explicitly makes that mechanism a
  product responsibility.
- Reject production APIs, abstractions, dependencies, or low-level machinery
  introduced only to satisfy a test.
- Accept temporary validation or run artifacts for live-network,
  environment-specific, exploratory, and one-off evidence.
- Passing validation is not evidence that every test is worth keeping.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish or expand the task.

Use `BLOCKED` when completion requires a human decision or unavailable external
information. Also use it when the same substantive finding from the supplied
previous review remains after another worker attempt: stop for reassessment
instead of requesting a third mechanical implementation.


# Canonical project context

# Project context

## Purpose

This project is a tool for research, navigation, and exploration of Nostr. It
is not being shaped as a conventional feed client. Its job is to help a person
acquire evidence, inspect it, navigate relationships, preserve useful collections,
and understand why a result is present.

The product foundation is a UI-independent library. The CLI, functional
verification, agents, and any future adapters are consumers of that library;
no presentation layer defines the domain boundary.

## Settled principles

- Memory is one process-local research environment shared by the library, CLI,
  functional verification, and future applications. It owns a renewable,
  capacity-bounded observation buffer, deliberately preserved evidence, and
  explicit research knowledge. These have different lifetimes and must not be
  conflated.
- A raw, valid Nostr event is immutable source evidence. Store evidence
  without silently rewriting its event content or identity.
- Indexes, relationship views, search terms, rankings, labels, and other
  interpretations are derived from evidence. They must be reproducible from
  their inputs and replaceable without treating them as the source record.
- Relay acquisition and querying local memory are distinct, composable
  operations. Acquisition may add observations and evidence; querying explains
  what the local research memory currently contains. A caller may compose
  either or both.
- Provenance is research output, not hidden transport bookkeeping. The system
  must make observable where evidence came from and the reason a result was
  included in a query, relationship traversal, or named notebook membership.
- Persistence and a database format are deliberately absent. Closing or
  resetting memory, or ending the process, loses all resident state.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **address** | A canonical NIP-01 coordinate for current replaceable or addressable event state; it is a stable subject distinct from every immutable historical event ID. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The process-local owner of the observation buffer, evidence archive, research notebook, and their derived indexes. |
| **observation buffer** | The renewable, capacity-bounded store of canonical events recently acquired from relays, their observations, and temporary indexes. Buffer evidence may be evicted. |
| **evidence archive** | Deliberately preserved evidence copied from the observation buffer at an explicit preservation level. Archive evidence is not silently evicted to make room for relay acquisition. |
| **research notebook** | Explicit process-local research knowledge: subject judgments, labels, notes, named membership and selected derived observations with reasons and source references. It is interpretation, not Nostr source evidence. |
| **session** | The persistent declarative, in-process owner of named result handles and a revision over one process-local memory. |
| **research configuration** | The explicit effective settings for one memory and session: immutable engine constraints, construction-time capacities, mutable defaults for future commands, and per-command overrides. |
| **result handle** | A session-owned name for an engine view. Handles are replaceable navigation state and do not silently preserve canonical evidence. |
| **subject collection** | A bounded set of stable Nostr subjects with membership reasons and provenance. |
| **research relation** | A bounded composable view of stable subjects, derived values, reasons, and provenance. Source-backed fields resolve from the archive or buffer; a relation must not accidentally become an undocumented evidence archive. |
| **field lineage** | Lightweight relation metadata recording which earlier field produced a renamed or grouped value and, when known, whether that value is a stable account or event identifier. It assists navigation without interpreting the value itself. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with the real process-local corpus.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, ranking method,
or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- provenance detail and notebook-membership semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the process-local owner of three distinct kinds of state:

- the observation buffer owns canonical relay events, observations, and
  temporary indexes, and may evict them according to its explicit capacity;
- the evidence archive owns only material deliberately preserved as a
  reference, bounded excerpt, or complete canonical event;
- the research notebook owns explicit interpretation and navigation knowledge,
  including judgments, labels, notes, memberships, reasons, and source
  references.

Resolution reports whether evidence came from the archive, the buffer, or is
currently unresolved. Ordinary acquisition never silently grows the archive
or notebook. Buffer eviction never silently deletes archived evidence or
notebook knowledge. Archive and notebook limits fail explicitly rather than
silently discarding research state.

A session is the persistent declarative research session: it owns named result
handles and a revision over one process-local memory. Commands name their
inputs and outputs explicitly; there is no active or current selection. A
result collection is the shared operation result passed between the library
and session layers. Handles remain views and do not silently copy complete
events. All state disappears on reset, close, or process exit; sessions are
not serialized.

Research configuration has explicit precedence and ownership. Engine
constraints describe immutable supported ranges. Memory, archive, and notebook
capacities are chosen when memory is constructed because changing them can
evict or reject state. Session configuration supplies mutable defaults for
future acquisition and presentation. Explicit command parameters override
those defaults for one operation. Generic session configuration never resizes
memory or silently changes existing evidence.

The coherent product path is memory, subject collections and research
relations, normalized operations, the declarative session, and its JSONL
adapter. Operation names and result kinds have one
authoritative definition shared by validation, execution, session handles,
schema output, and presentation. `show`, `inspect`, and `explain` remain one
deep bounded-observation module over those real result shapes; presentation
does not define alternate domain results or compatibility shapes.

Named plans and individual session commands share the same operation
representation. A command may name one `input` or a map of named `inputs`;
multi-input analysis is therefore available during an iterative session and
does not require a static plan or executable JavaScript. Relay-backed `fetch`
consumes relation fields, so acquisition can be directed by the current
analysis rather than hidden inside task-specific workflows. Pure `extract`
crosses relation values into stable subjects; protocol continuation starts
only from an explicit subject collection.

Relation transformations retain field lineage when fields are renamed or used
as grouping keys. This allows a later `extract` operation to recover a known
account/event transition without inferring meaning from the new field name.
Lineage is metadata, not evidence or a general type system. Technical
presentation facts such as per-row truncation remain separate from ordinary
analysis values.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
returns bounded acquisition coverage directly to the caller. Coverage says
that a precise relay/filter/budget attempt occurred. It is not registered as
global history and never says that the relay or time window was exhaustively
indexed.

The public research core is runtime-neutral and uses Web Platform primitives,
including the runtime's standard `WebSocket`, `TextEncoder`, Web Crypto,
timers, and abort signals. Acquisition has one implementation across direct,
plan, session, hydration, continuation, and relation-backed fetch execution;
runtime capabilities are not command parameters or serialized research state.
The JSONL executable remains a Node adapter that owns streams, process
arguments, signals, and CLI diagnostics.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.

Acquisition exposes separate operation-wide bounds for accepted valid relay
observations and distinct canonical event IDs. Duplicate observations consume
the observation budget but not the distinct-event budget. Reports keep
received packets, accepted observations, duplicate observations, newly stored
corpus events, and distinct events acquired separate, and identify which bound
stopped an operation.

Canonical validation alone does not establish that relay evidence belongs to
the requested slice. Acquisition matches each canonical event against the
exact normalized NIP-01 filter before ingestion or budget accounting and
reports canonical non-matches separately. Nested relay requests inside one
continuation are deliberately absent: one acquisition command performs one
explicit bounded relay attempt. Multi-step research composes those attempts
sequentially and keeps each outcome visible.

Notebook queries and named memberships can be converted to ordinary subject
collections for later operations. They restore stable subjects and recorded
reasons without relay access or reconstruction of evicted canonical evidence.
Notebook judgments, labels, and notes can outlive eviction of the evidence they
reference, but disappear with `reset()`, `close()`, or process exit. Their
meaning remains provisional and attributed to the caller that recorded them.

Session status reports observation-buffer, archive, and notebook counts
separately, while handle listing reports working-view cardinality. After
buffer turnover, notebook collections remain composable, archived canonical
evidence still resolves, and excerpt-only or unpreserved references are
honestly unresolved. Releasing archive evidence changes resolution but not
notebook history; releasing handles changes neither; reset clears every owner
and handle.

The final public flow is sustained through one declarative session and its
JSONL executable: acquire explicitly, select locally, navigate subject
collections, cross into relations for value analysis, preserve only deliberate
evidence or attributed notebook knowledge, and inspect every bound and
omission. Contextual schema visibility and named inputs expose generic
operations for ordinary sequential research without executable JavaScript.
Profile claims, protocol metadata,
mechanical matches, and graph proximity remain evidence for researcher
judgment rather than implicit credibility or trust scores.

Protocol relationship derivation is kind-aware and remains a replaceable view
over canonical evidence. Kind-1 and kind-1111 thread edges alone form
conversations; repost, reaction, and deletion targets retain distinct
relationship types. Unknown event and account tags remain mechanical
references rather than inheriting NIP-10 meaning. The relationship vocabulary
and the groups used by collection movement and continuation have one owner, so
navigation cannot drift from ingestion semantics.


# Selected task

---
id: 060-runtime-neutral-core
status: in_progress
max_attempts: 4
validation: workflow/tasks/060-runtime-neutral-core.validate.sh
depends_on: 059-inline-nostr-reference-navigation
---

# Make the established research core runtime-neutral

## Code findings

The public core is already largely based on Web Platform primitives. Two
production dependencies currently prevent a browser-compatible import:

- `acquire.js` imports `ws` and relies on its non-standard `terminate()` method
  plus Node timer `unref()` during socket teardown.
- `presentation.js` uses `Buffer.byteLength` to enforce bounded UTF-8 JSON
  output.

`jsonl-session.js` and the executable correctly own `node:readline`,
stdin/stdout, process arguments, and signals. They are Node adapters and must
remain outside the runtime-neutral core.

Acquisition is reached through direct calls, normalized operations, plans,
sessions, hydration, continuation, and relation-backed fetch. Any runtime
capability must therefore enter at the shared execution seam rather than being
smuggled into JSON operation parameters or implemented separately in callers.

## Goal

Allow the existing public memory, operation executor, declarative session,
schema, and bounded presentation modules to run with standard browser
primitives while preserving the Node JSONL caller's observable behavior.

## Required work

1. Remove the direct `ws` import and all assumptions about `terminate()` and
   timer `unref()` from the runtime-neutral acquisition implementation.
2. Prefer the standard WebSocket interface already available in supported
   Node versions and browsers. Introduce a tiny injected constructor or factory
   only if the standard global cannot preserve the acquisition contract.
   Do not build a generalized transport framework.
3. Make timeout, cancellation, EOSE, CLOSED, connection failure, and
   operation-wide budget completion settle deterministically without waiting
   indefinitely for a peer closing handshake. Once acquisition has finished,
   later socket messages must not mutate memory or accounting.
4. If injection is necessary, keep the capability outside normalized command
   parameters, schemas, provenance, and JSON serialization. Direct execution,
   plans, sessions, hydration, continuation, and fetch must still reach the
   same acquisition implementation.
5. Replace `Buffer.byteLength` with a small runtime-neutral UTF-8 byte
   measurement while preserving the existing approximate `sizeLimit`
   behavior and bounded presentation shapes.
6. Keep JSONL parsing, Node streams, signals, process arguments, and CLI
   diagnostics in the Node adapter. Do not make the browser import depend on
   `jsonl-session.js`.
7. Remove the `ws` package dependency if no Node adapter still needs it. Do
   not add another networking dependency merely to replace it.
8. Preserve operation names, command envelopes, result handles, schema,
   acquisition coverage, warnings, and public result shapes.
9. Update `CONTEXT.md`, package documentation, and the runtime-neutral
   milestone status only where the implemented seam is now a durable fact.

## Acceptance criteria

- Importing the public core does not require Node built-ins, `ws`, or
  `Buffer`.
- Acquisition uses one implementation across direct, plan, session,
  continuation, hydration, and fetch paths.
- Research commands remain JSON-serializable and contain no runtime objects.
- Timeout and cancellation return bounded partial outcomes and cannot ingest
  events after completion.
- The JSONL executable continues to expose the same caller-visible protocol.
- No frontend, alternate operation executor, connection pool, retry policy,
  relay-ranking policy, or transport framework is introduced.

## Verification

- Permanent tests expected: normally no new test.
- Stable public behavior protected: existing acquisition accounting,
  cancellation, operation execution, JSONL behavior, and bounded presentation.
- Existing public-boundary tests may be adjusted if implementation-neutral
  assertions are necessary, but must not test TCP, TLS, the WebSocket library,
  private socket helpers, process scheduling, or exact timing.
- Temporary task validation: syntax checks, the complete functional suite, a
  public-core import with `Buffer` unavailable, and inspection of the public
  core dependency graph for Node-only imports.
- Explicitly excluded: live relay reliability tests, browser UI, bundler
  selection, package splitting, persistence, TypeScript conversion, and a
  generalized networking abstraction.


# Worker report

Implemented the runtime-neutral core milestone.

Deliverables changed:

- Acquisition now uses the standard global WebSocket API.
- Removed `ws`, `terminate()`, and timer `unref()` assumptions.
- Completion is deterministic for timeout, cancellation, EOSE, CLOSED, failures, and budgets.
- Late socket messages cannot mutate completed acquisition results or memory.
- Presentation sizing now uses `TextEncoder` for UTF-8 measurement.
- Removed `ws` from package metadata and lockfile.
- Updated `CONTEXT.md`, package documentation, and milestone status.

Validation performed:

- Full task validation passed.
- All 23 functional tests passed.
- Syntax checks passed.
- Public-core import succeeded with `Buffer` unavailable.
- Confirmed no Node-only imports or `Buffer` usage in the public core.
- Temporary timeout scenario confirmed late messages cannot alter accounting.
- `git diff --check` passed.

Permanent tests added or expanded: none; existing public-boundary coverage plus temporary task validation was sufficient.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/protocol.js && node --check src/reference.js && node --check src/protocol-relationships.js && node --check src/configuration.js && node --check src/contract-facts.js && node --check src/memory.js && node --check src/collection.js && node --check src/acquire.js && node --check src/operations.js && node --check src/relation.js && node --check src/pipeline-source.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

✔ acquisition rejects unusable public inputs before networking (1.952333ms)
✔ address subjects navigate typed references to current local replaceable evidence (107.846583ms)
✔ ordinary acquisition accepts an explicit canonical #a filter (0.931625ms)
✔ direct, plan, and session execution share operation kinds and failure boundaries (36.205167ms)
✔ collections navigate identities while relations own value analysis (21.464583ms)
✔ named account and note handles continue with bounded relationship provenance (2241.950542ms)
✔ factual schemas construct commands accepted through the public session seam (33.011291ms)
✔ declarative observation and lifecycle form one bounded public workflow (36.659667ms)
✔ relation summaries compact source selection details without losing their shape (6.362417ms)
✔ declarative named results compose compatible sets and expose their schema (10.579ms)
✔ declarative notebook knowledge survives turnover and remains independent from evidence (16.69025ms)
✔ explicit archive preservation survives complete buffer turnover and releases atomically (71.82ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (42.615375ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (32.142833ms)
✔ JSONL executable provides one persistent bounded process workflow (105.387709ms)
✔ process-local memory preserves canonical evidence and independent relay observations (34.145959ms)
✔ public references normalize to stable subjects while hints stay attributed metadata (3.519625ms)
✔ mixed event kinds derive truthful references without polluting conversations (55.34675ms)
✔ inline NIP-27 references navigate as typed, explainable evidence without becoming threads (12.434791ms)
✔ replaceable selection and follow interpretation remain stable in one process (30.19325ms)
✔ public local search composes constraints, explains matches, and preserves provenance (24.8505ms)
✔ relation handles resolve references across evidence lifetime and keep bounded views composable (52.205ms)
✔ large notebook membership is atomic, bounded, process-local, and directly navigable (2248.665375ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2522.730916


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.