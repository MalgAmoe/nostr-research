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
id: 013-in-memory-research-workspace
status: in_progress
max_attempts: 5
validation: workflow/tasks/013-in-memory-research-workspace.validate.sh
depends_on: 012-research-sessions-and-coverage
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add a bounded in-memory research workspace

## Objective

Make an in-process corpus the active environment for iterative research while
retaining SQLite as the current durable evidence store.

This is not a second permanent data model and not a generic storage backend.
It is a bounded, disposable working set that can be rebuilt from memory,
incrementally updated, and searched or navigated repeatedly without returning
to SQLite for every step.

## Runtime model

Expose one cohesive public workspace entry point. It must:

- attach to an open `ResearchMemory`;
- explicitly load a caller-selected, bounded slice of stored canonical events;
- incrementally accept newly acquired or explicitly selected stored evidence;
- deduplicate canonical events by event ID;
- preserve relay observations and relationship interpretation;
- maintain useful indexes for event ID, author, kind, tags, and inbound/outbound
  relationships;
- expose counts and bounds without dumping the corpus; and
- enforce a caller-visible event capacity with deterministic eviction.

The workspace is temporary. Closing it must not delete durable evidence.
Opening a new workspace over the same SQLite memory must reproduce the selected
working corpus.

## Operations

Provide a small composable surface that covers the actual research loop:

- load or add evidence;
- select events using the existing meaningful query constraints;
- turn results into the shared result-collection vocabulary;
- traverse stored relationships in either direction with explicit depth and
  limits;
- inspect a subject with canonical evidence and provenance; and
- retain a chosen collection through the attached durable memory.

Reuse existing query validation, subject vocabulary, relationship semantics,
and projections where they remain appropriate. Do not create subtly different
meanings for the same public terms.

The workspace may call SQLite for explicit persistence, corpus loading, or
evidence detail that was not loaded. Ordinary repeated selection and traversal
over the loaded corpus must operate on the in-memory structures.

## Boundaries

- SQLite remains the only persistence implementation.
- Do not introduce a generic database adapter, ORM, HTTP API, worker protocol,
  UI, ranking system, or discovery heuristic.
- Do not attempt to hold an unbounded relay or the whole Nostr network.
- Do not duplicate the complete `ResearchMemory` method surface.
- Do not expose internal maps as mutable public state.
- Keep implementation cohesive; do not split every index into its own class.

## Documentation

Document the distinction between durable research memory, the temporary
in-memory workspace, reusable result collections, and sessions. Update
`CONTEXT.md` only with vocabulary that is settled by the implementation.

## Verification

Add one public functional scenario that:

- stores a corpus large enough to exercise the capacity;
- loads a bounded workspace and verifies deterministic contents;
- performs repeated text/author/tag selection and bidirectional traversal;
- incrementally introduces new stored evidence and deduplicates it;
- retains a workspace result;
- closes and recreates the workspace from SQLite; and
- proves evicted workspace events remain durable.

Do not add tests for private maps or individual index helpers.

## Acceptance criteria

- In-memory corpus size is explicitly bounded.
- Selection and traversal over loaded evidence do not query SQLite per step.
- Results remain compatible with sessions, projection, and retention.
- Relay observations and relationship explanations remain available.
- Workspace eviction never deletes SQLite evidence.
- Existing library and CLI behavior remain usable.
- Permanent verification stays at the public functional boundary.


# Worker report

- Deliverables changed: workspace hydration now always resolves canonical evidence and current observations from SQLite; functional scenario verifies stale collection refresh after a new relay observation.
- Validation: targeted workspace test passed; full task validation passed (16 tests passed, 4 network tests skipped due to sandbox restrictions); syntax and CLI checks passed.
- Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:44733) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44733) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (181.80175ms)
✔ global limit and cancellation are distinguishable and close owned sockets (135.267583ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (153.454208ms)
✔ timeout and partial connection failure remain observable (135.961416ms)
✔ acquisition rejects unusable public inputs before networking (5.373791ms)
(node:44742) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44767) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44769) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44793) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44795) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44819) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44821) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44822) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44845) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44846) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44847) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44850) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44852) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44899) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (752.537958ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (49.249458ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (197.089208ms)
(node:44735) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (54.697416ms)
(node:44736) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (45.196333ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (26.238583ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (37.209958ms)
(node:44737) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1836.208333ms)
(node:44738) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (53.2275ms)
(node:44739) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44765) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44768) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44792) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44794) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44796) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44820) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (406.62975ms)
(node:44740) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (57.284208ms)
✔ sessions start from public runs returned by recordRun and getRun (13.487375ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (14.07025ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (4.057208ms)
(node:44741) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (68.395709ms)
ℹ tests 20
ℹ suites 0
ℹ pass 20
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10399.901125

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/session.js && node --check src/planning.js && node --check bin/nostr-research-memory.js

(node:44961) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.