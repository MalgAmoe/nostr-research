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

Implemented task 025’s single-corpus runtime.

Deliverables changed:

- Moved console, acquisition, expansion, reply contexts, sessions, search, inspection, facets, runs, and retained sets onto the bounded in-memory corpus.
- Removed console `--db` and `research.workspace`; `--capacity` is required.
- Added observable acquisition additions, refreshes, evictions, and corpus bounds.
- Added local `load()` and resident-aware `inspect()`.
- Preserved retained subject references after evidence eviction.
- Updated functional scenarios, package metadata, and README.

Validation:

- Task validation script passed.
- 18 tests passed; 9 network tests skipped because loopback listeners are sandbox-blocked.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainties:

- Network scenarios could not execute in this sandbox; their non-network input validation remains covered.
- Runner-owned task state and `workflow/runs/` artifacts were left untouched.

# Validation output

Exit code: 1


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-console.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:17182) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:17182) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (201.483708ms)
✔ global limit and cancellation are distinguishable and close owned sockets (184.310833ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (187.824292ms)
✔ timeout and partial connection failure remain observable (156.610958ms)
✔ acquisition rejects unusable public inputs before networking (4.936625ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.735833ms)
✖ authored-note expansion samples only explicit account starts within per-account and global bounds (101.927333ms)
✖ authored-note expansion obeys the complete operation budget and stays disabled by default (37.515708ms)
✖ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (40.078416ms)
✖ console expansion performs bounded targeted multi-hop acquisition (106.773292ms)
✖ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (84.096958ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (329.909375ms)
(node:17184) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ in-process memory matches the SQLite oracle across the research surface (95.213208ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (18.854584ms)
(node:17185) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (50.920166ms)
(node:17186) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (224.471625ms)
(node:17187) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (75.701583ms)
(node:17188) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (74.765084ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (28.234833ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (57.615875ms)
(node:17189) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (2782.054542ms)
(node:17190) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (66.970166ms)
(node:17214) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (52.714917ms)
(node:17215) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (44.492833ms)
✔ sessions start from public runs returned by recordRun and getRun (11.902458ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (10.696625ms)
(node:17217) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (57.981042ms)
ℹ tests 27
ℹ suites 0
ℹ pass 22
ℹ fail 5
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10494.634416

✖ failing tests:

test at test/acquisition.functional.test.js:287:1
✖ authored-note expansion samples only explicit account starts within per-account and global bounds (101.927333ms)
  Error [ResearchMemoryError]: A bounded in-memory research corpus is required.
      at normalizeExpansionOptions (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:197:11)
      at expandResearch (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:18:22)
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:333:26)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7)

test at test/acquisition.functional.test.js:444:1
✖ authored-note expansion obeys the complete operation budget and stays disabled by default (37.515708ms)
  Error [ResearchMemoryError]: A bounded in-memory research corpus is required.
      at normalizeExpansionOptions (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:197:11)
      at expandResearch (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:18:22)
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:473:27)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7)

test at test/acquisition.functional.test.js:524:1
✖ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (40.078416ms)
  TypeError: progress.write is not a function
      at Object.replyContexts (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/console.js:160:16)
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:613:47)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7)

test at test/acquisition.functional.test.js:733:1
✖ console expansion performs bounded targeted multi-hop acquisition (106.773292ms)
  Error [ResearchMemoryError]: A bounded in-memory research corpus is required.
      at normalizeExpansionOptions (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:197:11)
      at Object.expand (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/console.js:119:7)
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:777:49)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7)

test at test/acquisition.functional.test.js:850:1
✖ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (84.096958ms)
  Error [ResearchMemoryError]: A bounded in-memory research corpus is required.
      at normalizeExpansionOptions (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:197:11)
      at expandResearch (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/src/expansion.js:18:22)
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:881:25)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7)
npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path /Users/malg/Documents/Codex/nostr/packages/nostr-research
npm error workspace @nostr-research/memory@0.1.0
npm error location /Users/malg/Documents/Codex/nostr/packages/nostr-research
npm error command failed
npm error command sh -c node --test


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.