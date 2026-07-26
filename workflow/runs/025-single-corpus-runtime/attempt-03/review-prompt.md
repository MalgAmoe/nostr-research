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
id: 025-single-corpus-runtime
status: in_progress
max_attempts: 5
validation: workflow/tasks/025-single-corpus-runtime.validate.sh
depends_on: 024-in-memory-research-memory
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Move the complete research runtime onto one corpus

## Decision

The in-memory research memory from task 024 is now the sole active corpus for
the running application. The durable-memory plus temporary-workspace split is
being removed. SQLite may remain in the repository only as the temporary
comparison implementation until the cleanup task that follows.

## Objective

Move every active research workflow onto one capacity-bounded in-memory owner
without losing same-process capabilities.

Update:

- relay acquisition;
- targeted expansion;
- bounded reply-context resolution;
- sessions;
- presentation and facets;
- the persistent JavaScript console; and
- their public functional scenarios.

## Runtime semantics

- Relay acquisition ingests directly into the active corpus.
- There is no acquire-into-memory then hydrate-workspace step.
- Expansion and reply-context resolution receive one corpus rather than a
  durable memory plus a second workspace.
- Explicit expansion starts remain protected for the duration of bounded
  additions.
- Acquisition and expansion make additions, refreshes, evictions, capacity
  pressure, limits, cancellation, and partial relay outcomes observable.
- Events and accounts search the same resident corpus.
- Sessions, inspection, projection, facets, runs, retained sets, and set
  operations use that same corpus.
- `load(query)` becomes a local selection/use operation over the resident
  corpus. It may replace session selection, but it does not reconstruct a
  second corpus or silently contact relays.
- A retained group remains usable during the process even when a member's
  canonical evidence has been evicted; inspection must distinguish a retained
  subject reference from resident evidence.
- "Stored" means resident in the current corpus, not durably accumulated
  behind it.

The console remains Node-based in this milestone. Remove the `--db` argument
and keep explicit `--capacity`. Preserve `research.memory` as the advanced
access route. Remove `research.workspace` rather than maintaining a permanent
alias.

## Boundaries

Do not remove other Node-specific modules yet. Keep `node:fs`, `node:crypto`,
the `ws` package, Node REPL, and the Node test runner where currently needed.

Do not build browser entry points, persistence, storage adapters, import/export,
workers, Rust/Wasm, ranking, automatic crawling, or compatibility layers for
the old console command.

The current package is experimental: make one clear breaking change rather
than supporting parallel runtime concepts.

## Verification

Verify one complete public research process:

1. create a bounded memory;
2. ingest or acquire canonical evidence;
3. search events and accounts;
4. select and orient with facets;
5. navigate current profiles, follows, and relationships;
6. traverse and perform targeted expansion;
7. resolve bounded reply contexts;
8. inspect evidence and provenance;
9. retain and combine named groups;
10. continue from a retained group; and
11. observe deterministic capacity pressure and eviction.

Network functional tests must continue to cover explicit limits,
cancellation, timeout, partial failures, deduplication, and provenance.
Tests should exercise public boundaries and must not inspect internal maps.

## Acceptance criteria

- Production runtime paths use one in-memory corpus.
- No active operation requires both memory and workspace objects.
- Acquisition does not write and reread the same event through SQLite.
- Search, navigation, expansion, reply contexts, sessions, presentation,
  coverage, runs, and retained groups remain usable in one process.
- Console startup requires capacity but no database path.
- Corpus pressure and evictions are visible.
- The complete functional suite and syntax checks pass.



# Worker report

Deliverables changed:

- Fixed acquisition coverage under same-operation eviction.
- Preserved relay provenance in expansion results.
- Corrected default authored-expansion scenario.
- Updated inspection assertion to use `resident`.
- Kept SQLite comparison behavior aligned.

Validation:

- `npm test`: 27 tests, 18 passed, 9 network tests skipped due sandbox loopback restrictions, 0 failures.
- `npm run check`: passed.
- Task validator: passed.
- `git diff --check`: passed.

Unresolved uncertainty:

- Loopback network scenarios could not run in this sandbox; they remain available for the reviewer environment.

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

(node:20055) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:20055) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (135.535917ms)
✔ global limit and cancellation are distinguishable and close owned sockets (218.908208ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (158.731208ms)
✔ timeout and partial connection failure remain observable (149.445084ms)
✔ acquisition rejects unusable public inputs before networking (10.58025ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.753167ms)
Expanding through 2 relay(s), depth 2, event limit 10, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 observation(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (101.335625ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (47.087875ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 observation(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (177.569958ms)
Expanding through 2 relay(s), depth 2, event limit 10...
Expansion completed: 6 request(s), 4 observation(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (82.941375ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (93.617ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (350.434375ms)
(node:20057) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ in-process memory matches the SQLite oracle across the research surface (114.583042ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (25.393458ms)
(node:20058) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (62.652667ms)
(node:20059) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (272.569083ms)
(node:20060) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (93.400333ms)
(node:20061) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (55.738666ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (35.570417ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (92.401667ms)
(node:20062) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (2763.887375ms)
(node:20063) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (58.849292ms)
(node:20086) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (80.153709ms)
(node:20089) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (52.254125ms)
✔ sessions start from public runs returned by recordRun and getRun (14.241209ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (10.602125ms)
(node:20093) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (64.116125ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10447.156083


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.