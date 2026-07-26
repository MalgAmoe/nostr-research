# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.
Do not stage or commit changes; the runner owns the task commit after review.

If a previous review is supplied, address every applicable finding explicitly.
Do not merely describe work that should be done: perform the task within its
stated permissions.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
- unresolved uncertainties.


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



# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/test/in-memory-memory.functional.test.js` does not prove the required eviction invariant for source relationships. The evicted `target` event contributes no `quoted-event` edge, while the post-eviction assertion only traverses `quoted-event` relationships. Add an evicted event that contributes a relationship, then verify through public traversal/navigation that its source edge disappears, while retaining the existing check that an edge from a resident source to an evicted target remains visible with an unresolved target.