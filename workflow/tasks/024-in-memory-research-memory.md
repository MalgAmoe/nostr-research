---
id: 024-in-memory-research-memory
status: done
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

