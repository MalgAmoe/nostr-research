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

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish.

Use `BLOCKED` only when completion requires a human decision or unavailable
external information.


# Canonical project context

# Project context

## Purpose

This project is a tool for research, navigation, and exploration of Nostr. It
is not being shaped as a conventional feed client. Its job is to help a person
acquire evidence, inspect it, navigate relationships, preserve useful sets,
and understand why a result is present.

The product foundation is a UI-independent library. The CLI, functional
verification, agents, and any future adapters are consumers of that library;
no presentation layer defines the domain boundary.

## Settled principles

- SQLite is the one real storage path for the library, CLI, functional
  verification, and future applications. Do not introduce an in-memory store
  as a production or functional-test substitute.
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
  included in a query, relationship traversal, or saved set.
- Experimental databases are disposable and regenerable. During this phase
  there is no compatibility or migration burden for database formats.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The local SQLite-backed research record of evidence, observations, and replaceable derived material. |
| **workspace** | A bounded, disposable in-process corpus of stored evidence with private indexes for repeated selection and relationship traversal; it is attached to memory and is not a persistence implementation. |
| **session** | A temporary, in-process research playground coordinating selection, focus, provisional exclusions, branches, and meaningful actions over memory. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **focus** | An optional subject receiving attention in a session; it is independent of and does not rewrite the selection. |
| **temporary branch** | A session-local named snapshot of selection, focus, and exclusions used to revisit an exploratory path; it is not durable evidence. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | A durable record of one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One durable recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it; unlike a session, it is an immutable operation snapshot. |
| **research set** | A deliberately saved, named or otherwise identifiable group of evidence for later inspection or expansion. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with real SQLite.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, permanent
database schema, ranking method, or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- the durable provenance detail and research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Playground boundaries

A workspace is a bounded temporary corpus rebuilt from caller-selected durable
evidence. It accelerates repeated local selection and traversal but does not
replace memory or make evicted evidence less durable. A session coordinates
selection, focus, exclusions, history, and temporary branches over memory
operations or their workspace equivalents. A result collection is the shared
operation result passed between these layers. A research set is the explicit
durable checkpoint of chosen subjects and reasons; a research run is a durable
account of an operation. Neither a workspace, a session, nor session branches
are serialized as a whole.

Local selection asks what the current SQLite memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
records bounded acquisition coverage. Coverage says that a precise
relay/filter/budget attempt occurred. It never says that the relay or time
window was exhaustively indexed.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.


# Selected task

---
id: 024-in-memory-research-memory
status: in_progress
max_attempts: 5
validation: workflow/tasks/024-in-memory-research-memory.validate.sh
depends_on: 023-bounded-reply-contexts
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Build the complete in-memory research memory

## Decision

The project is replacing SQLite with project-owned JavaScript data structures.
This task deliberately supersedes `CONTEXT.md` where it currently says SQLite
is the one real storage path. Persistence and browser execution are separate
future concerns.

This task builds the new implementation alongside the current SQLite memory so
that public behavior can be compared before the runtime switches. The
SQLite implementation is a temporary migration oracle, not a permanent
adapter or supported alternative.

## Objective

Implement one capacity-bounded in-process research memory that can eventually
own the complete running research corpus. Reuse and promote the proven
JavaScript indexing mechanics in the current `ResearchWorkspace`; do not build
an unrelated second set of indexes.

The implementation must support, in memory:

- canonical event validation and one canonical event per event ID;
- independent observations for every accepted encounter;
- event lookup and compound local selection;
- deterministic ordering and unambiguous prefix resolution;
- account/profile search and resolution;
- current replaceable-event semantics, contact lists, and follows;
- attributed inbound and outbound protocol relationships;
- bounded traversal, threads, result collections, and projection;
- acquisition coverage records;
- research runs; and
- named research sets, membership reasons, expansion, combination, and
  retention.

All these records are process-local. No method in the new implementation may
claim persistence or reopening.

## Ownership and mutation

Use one cohesive owner for canonical event records and all derived indexes.
Do not introduce repositories, storage adapters, an ORM, a transaction
framework, or one class per index.

- Clone canonical evidence at ingestion so later caller mutation cannot alter
  stored evidence.
- Validate and derive relationships before mutating owned state.
- Centralize record insertion and removal so author, kind, tag, and
  relationship indexes cannot drift.
- Duplicate event IDs do not consume capacity; they add observations.
- Capacity applies to resident canonical events and uses deterministic FIFO
  eviction initially.
- Eviction removes the event record, its observations, and all relationships
  contributed by that source event.
- An inbound edge contributed by a retained source remains when only its target
  event is evicted; the target becomes unresolved.
- Public operations must not expose mutable internal maps, sets, arrays, or
  canonical records.
- Runs, sets, and acquisition coverage remain available within the current
  process. Their current public capabilities should not be redesigned in this
  task.

## Scope

Do not switch acquisition, expansion, the console, or other consumers yet.
Do not delete the SQLite implementation yet. Keep any comparison-only surface
private or test-only so it can be removed cleanly.

Do not add IndexedDB, OPFS, local storage, import/export, Web Workers, Rust,
Wasm, browser bundling, a query DSL, or automatic relay behavior.

Keep modules cohesive. A small extraction of stable protocol/query/value
helpers is acceptable when both migration implementations genuinely need it;
avoid pass-through abstractions.

## Verification

Exercise behavior through public operations, not private maps.

Feed identical canonical fixtures and observations to the SQLite oracle and
new in-memory memory, then compare normalized results for:

- event selection, constraints, reasons, provenance, and ordering;
- account resolution, profile search, and ambiguity errors;
- replaceable metadata, contact lists, and follows;
- inbound/outbound relationship navigation and traversal;
- threads and projection;
- acquisition coverage;
- research runs; and
- retained sets and set operations.

Add one focused invariant scenario after mixed ingestion, duplicate
observations, and eviction. It must prove through public behavior that counts,
queries, resolution, and traversal contain no evidence or source edges from an
evicted event and that retained source edges can still expose an unresolved
target.

Do not add unit tests for individual Map/Set helpers or freeze temporary class
layout.

## Acceptance criteria

- A complete capacity-bounded in-memory research memory exists.
- It preserves the current same-process research capabilities listed above.
- Canonical evidence cannot be mutated through caller-owned input or returned
  public values.
- Index and eviction semantics are coherent and deterministic.
- SQLite remains only as a short-lived comparison oracle.
- Existing production consumers still operate on their previous path.
- The complete functional suite and syntax checks pass.



# Worker report

Deliverables changed:
- Strengthened the eviction invariant in `in-memory-memory.functional.test.js`.
- Evicted event now contributes a quote edge.
- Public traversal verifies that edge disappears after eviction, while a retained source still exposes its evicted target as unresolved.

Validation:
- Focused functional test: 2/2 passed.
- Task validation script passed.
- Full suite: 18 passed, 9 network tests skipped due sandbox restrictions.
- Syntax checks passed.

Unresolved uncertainties:
- None.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-console.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:12297) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:12297) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (197.744583ms)
✔ global limit and cancellation are distinguishable and close owned sockets (209.625ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (264.274916ms)
✔ timeout and partial connection failure remain observable (164.904917ms)
✔ acquisition rejects unusable public inputs before networking (4.631083ms)
✔ console expansion rejects invalid bounds and semantics before networking (5.581875ms)
Expanding through 2 relay(s), depth 2, event limit 10, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 observation(s), 7 workspace event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (150.621042ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (105.222083ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 observation(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (148.375333ms)
Expanding through 2 relay(s), depth 2, event limit 10...
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (149.950166ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (210.796417ms)
(node:12298) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (341.978584ms)
(node:12299) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ in-process memory matches the SQLite oracle across the research surface (80.75625ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (16.90375ms)
(node:12300) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (69.340375ms)
(node:12301) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (260.665167ms)
(node:12302) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (60.578416ms)
(node:12303) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (64.459667ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (39.91225ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (50.88425ms)
(node:12304) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (2139.427959ms)
(node:12305) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (69.955167ms)
(node:12329) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (48.686834ms)
(node:12330) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (47.472167ms)
✔ sessions start from public runs returned by recordRun and getRun (11.633208ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (12.267334ms)
(node:12331) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (59.166875ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10549.404125


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.