# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
files. Do not repair the work.

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

The product foundation is a UI-independent library. A CLI, functional
verification, and future user interfaces are consumers of that library; a UI
does not define the domain boundary. The current Solid application is a
behavioral reference during this work. Its code and observed behavior may be
retained, recreated, or rejected deliberately; neither its Solid controllers,
browser persistence, nor its present module layout is an implicit target
architecture.

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
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it. |
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
- which future UI workflows, if any, should consume the library.

The current application contains useful behavior in all of these areas, but it
does not settle them. In particular, its IndexedDB/localStorage persistence,
Solid state, hidden array metadata, relay cache policy, and editorial scoring
heuristics must not be copied into the library by default.


# Selected task

---
id: 007-saved-research
status: in_progress
max_attempts: 5
validation: workflow/tasks/007-saved-research.validate.sh
depends_on: 006-query-and-navigate-memory
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Preserve and continue research paths

## Objective

Let callers preserve how evidence was selected, reopen it later, and continue
research without relying on UI session state or conversation memory.

Build this on the existing acquisition, local-query, navigation, and SQLite
boundaries. Keep the model small enough to evolve.

## Research runs

Persist an immutable record for a completed acquisition or local-query
operation containing:

- a stable run identifier;
- operation type and normalized public inputs;
- start and finish times;
- completion status and diagnostics;
- result event and account identifiers;
- enough provenance and match-reason information to explain the recorded
  result without reproducing hidden UI state.

A run records what happened. Re-running the same inputs creates another run
rather than rewriting history.

Do not store sockets, callbacks, transient implementation state, or SQL details.

## Research sets

Support durable named sets that can contain event and account identifiers:

- create, list, inspect, rename, and delete a set;
- add and remove members explicitly;
- retain one or more membership reasons and the source run or source entity
  when applicable;
- create a set from a recorded run;
- reopen the database and continue using the same set;
- tolerate referenced evidence that is not yet present locally.

Names are user-facing labels, not identity. Set identifiers must remain stable
when renamed.

## Continuation and set operations

Through the public library boundary:

- expand a set using selected observable relationship types already supported
  by local navigation;
- preserve the source member and relationship evidence for expanded members;
- combine sets using union, intersection, and difference without mutating the
  input sets;
- distinguish event and account members;
- explain why every member is in a resulting or expanded set.

No operation should silently contact a relay. A future caller can explicitly
run acquisition and then record or add its results.

## CLI behavior

Add discoverable structured commands that can:

- record or save the result of an acquisition or local query as a run;
- list and inspect runs;
- create and manage named sets;
- create a set from a run;
- expand a set;
- combine sets;
- explain one set member.

The exact command grouping may remain compact, but it must be practical for a
human or Codex CLI workflow and must not require direct SQLite access.

## Scope boundaries

- Do not add UI state, tabs, layouts, browsing history, ranking, suggestions,
  moderation policy, synchronization, accounts-to-follow semantics, or remote
  storage.
- Do not preserve compatibility with disposable databases created before this
  task.
- Do not introduce a general workflow engine or abstract graph framework.
- Do not force all future research methodology into one fixed schema.

## Verification

Use the public library and CLI with a temporary real SQLite database to perform
one complete black-box path:

1. ingest or acquire signed evidence;
2. perform a local query and record its run;
3. create a set from that run;
4. expand it through an observable relationship;
5. combine it with another set;
6. close and reopen the database;
7. inspect the saved set and explain membership.

The functional scenario should verify behavior, not internal tables. Add no
per-helper or per-command tests.

The independent reviewer must create its own set names and operation sequence,
including at least one unresolved entity, removal, rename, and set difference.

## Acceptance criteria

- Runs preserve public operation inputs, outcomes, result identifiers, reasons,
  and diagnostics without UI state.
- Saved sets survive database close and reopen.
- Every derived membership is explainable from explicit selection, a run,
  another set, or stored relationship evidence.
- Expansion and set operations are deterministic and bounded.
- Input sets are not mutated by union, intersection, or difference.
- Missing local evidence remains representable.
- CLI output is structured and failures are useful and non-zero.
- The schema and API remain focused on research paths rather than generalized
  application state.
- Reference-client behavior and source remain unchanged.


# Worker report

Implemented saved research paths.

Deliverables changed:

- Added immutable research runs with inputs, timing, status, diagnostics, results, provenance, and match reasons.
- Added durable named sets with lifecycle, membership, explanations, run import, expansion, and set algebra.
- Added structured CLI `run` and `set` commands plus acquisition `--record`.
- Added end-to-end SQLite/CLI functional coverage.
- Updated package documentation.

Validation:

- Package tests pass: 6 passed, 4 network-dependent skipped by sandbox.
- Syntax checks pass.
- CLI help exposes `run` and `set`.
- `git diff --check` passes.
- Full validator reached its final `npm exec` checks, but npm itself exhausted memory resolving the local binary. Direct invocation of the same binary and help checks pass.

Unresolved uncertainty:

- Live relay tests could not run because the sandbox forbids loopback listeners.
- The npm-exec environment failure remains external to the CLI implementation.

# Validation output

Exit code: 0


> @nostr-research/memory@0.1.0 test
> node --test

(node:41621) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41621) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (125.57275ms)
✔ global limit and cancellation are distinguishable and close owned sockets (126.976042ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (135.206917ms)
✔ timeout and partial connection failure remain observable (131.915542ms)
✔ acquisition rejects unusable public inputs before networking (5.092792ms)
(node:41622) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (34.201125ms)
(node:41623) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (22.694875ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (17.116416ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (21.044125ms)
(node:41624) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41640) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41641) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41642) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41658) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41659) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41675) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (313.30175ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10304.479042

> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check bin/nostr-research-memory.js

(node:41735) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:41754) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.