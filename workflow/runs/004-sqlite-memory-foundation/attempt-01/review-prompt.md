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
id: 004-sqlite-memory-foundation
status: in_progress
max_attempts: 5
validation: workflow/tasks/004-sqlite-memory-foundation.validate.sh
depends_on: 003-separate-reference-application
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Build the SQLite research-memory foundation

## Objective

Build the first usable UI-independent library slice using the same real SQLite
storage path that the CLI, functional verification, and future applications
will use.

This task proves storage and ingestion through observable behavior. It does not
design the complete research system.

## Required behavior

Through the public library boundary:

- create or open a SQLite research-memory file;
- deliberately reset a disposable database;
- accept a valid canonical Nostr event;
- reject an event whose ID, signature, or required event structure is invalid;
- store one canonical raw event per event ID;
- record independently where and when the event was observed;
- ingesting the same event from another relay must not duplicate the event and
  must retain the additional observation;
- retrieve an event with its observations;
- import reproducible fixture events;
- report useful database counts without knowledge of internal tables.

Expose a minimal CLI that exercises the same public library boundary:

- initialize/open a database;
- reset it explicitly;
- import fixture events with a supplied relay observation;
- inspect one event and its provenance;
- print summary counts.

Commands and output should be discoverable and suitable for later Codex-driven
research workflows.

## Storage and fixture constraints

- Use SQLite directly; do not create an in-memory repository implementation.
- Prefer the runtime's supported SQLite capability when it is adequate; do not
  add a native dependency without a demonstrated need.
- Keep the schema minimal to this task: canonical events, observations, and
  only essential schema metadata.
- Store the raw event without losing tags or content.
- Database files are generated artifacts and ignored by Git.
- Fixture source must be plain, inspectable, reproducible data or a deterministic
  generator. Do not treat a committed opaque SQLite file as the source fixture.
- No migration or backward-compatibility framework is required.
- Do not yet introduce research runs, research sets, profile resolution,
  relationship indexes, ranking, relay networking, or UI integration.

## Verification policy

- Add permanent unit tests only for a difficult protocol invariant if the
  runtime or trusted Nostr library does not already establish it.
- Add one small black-box functional test or executable acceptance scenario
  using the public library/CLI and a temporary real SQLite file.
- Do not import private helpers, query internal tables, assert SQL statements,
  or freeze the module layout.
- The reviewer must independently operate the public CLI against a disposable
  database and inspect observable results.

## Acceptance criteria

- Library consumers do not need to know the SQLite schema.
- The same SQLite implementation is used by the CLI and functional
  verification.
- Canonical-event deduplication and multi-relay provenance work observably.
- Invalid Nostr events do not enter memory.
- The database can be discarded and recreated from fixture sources.
- CLI failures use non-zero exit status and useful error messages.
- Public resources are closed cleanly so commands and tests terminate.
- The package remains small and has no UI or Solid dependency.
- Reference-client behavior and source remain unchanged.


# Worker report

Deliverables created/changed:
- SQLite-backed `@nostr-research/memory` library with canonical event validation, deduplication, provenance observations, reset, fixture import, retrieval, and summary.
- `nostr-research-memory` CLI: init, reset, import-fixture, inspect, summary.
- Inspectable signed fixture corpus and public-library functional test.
- Package documentation and workspace lockfile updates.

Validation performed:
- `npm test --workspace packages/nostr-research`
- `npm run check --workspace packages/nostr-research`
- `workflow/tasks/004-sqlite-memory-foundation.validate.sh`
- Manual two-relay import/inspect/reset/non-zero failure exercise.
- Confirmed no protected paths changed.

Unresolved uncertainties:
- Node emits its current experimental `node:sqlite` warning.
- Local default npm cache is root-owned; validation passed using a writable temporary npm cache.

# Validation output

Exit code: 0


> @nostr-research/memory@0.1.0 test
> node --test

(node:23849) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (23.726542ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 80.761792

> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check bin/nostr-research-memory.js

(node:23888) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
{
  "database": "/var/folders/24/7mvdl8yn13gcc39qcp4hhygm0000gn/T//nostr-research-workflow-23829.sqlite",
  "events": 0,
  "observations": 0
}
(node:23916) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
{
  "database": "/var/folders/24/7mvdl8yn13gcc39qcp4hhygm0000gn/T//nostr-research-workflow-23829.sqlite",
  "imported": 2,
  "relay": "wss://fixture.example",
  "events": 2,
  "observations": 2
}
(node:23934) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
{
  "database": "/var/folders/24/7mvdl8yn13gcc39qcp4hhygm0000gn/T//nostr-research-workflow-23829.sqlite",
  "events": 2,
  "observations": 2
}


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.