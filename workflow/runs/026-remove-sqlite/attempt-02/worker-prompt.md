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

- Memory is one capacity-bounded, process-local corpus shared by the library,
  CLI, functional verification, and future applications.
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
- Persistence and a database format are deliberately absent. Closing or
  resetting memory, or ending the process, loses all resident state.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The bounded process-local research corpus of evidence, observations, and replaceable derived material. |
| **session** | A temporary, in-process research playground coordinating selection, focus, provisional exclusions, branches, and meaningful actions over memory. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **focus** | An optional subject receiving attention in a session; it is independent of and does not rewrite the selection. |
| **temporary branch** | A session-local named snapshot of selection, focus, and exclusions used to revisit an exploratory path; it is not durable evidence. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | A process-local record of one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One process-local recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it; unlike a session, it is an immutable operation snapshot. |
| **research set** | A deliberately retained, named group of subjects for later inspection or expansion during the running process. |
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
- provenance detail and process-local research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the only authoritative corpus. A session coordinates selection, focus,
exclusions, history, and temporary branches over memory operations. A result
collection is the shared operation result passed between these layers. A research
set is a process-local checkpoint; a research run is a process-local account of an
operation. Retained groups, runs, and coverage disappear with the corpus. Sessions
and branches are not serialized.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
records bounded acquisition coverage. Coverage says that a precise
relay/filter/budget attempt occurred. It never says that the relay or time
window was exhaustively indexed.

Removing the remaining Node dependencies is a separate future milestone.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.


# Selected task

---
id: 026-remove-sqlite
status: in_progress
max_attempts: 5
validation: workflow/tasks/026-remove-sqlite.validate.sh
depends_on: 025-single-corpus-runtime
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Remove SQLite and obsolete persistence assumptions

## Objective

Delete the superseded SQLite implementation and finish the milestone with one
simple Node-based, in-memory JavaScript research library.

This task removes storage and persistence complexity. It does not attempt the
separate future milestone of removing all Node dependencies.

## Remove

- `node:sqlite` and every SQL statement;
- schema creation, schema versions, migrations, foreign keys, and transaction
  wrappers;
- database paths and database-path public state;
- the old SQLite memory and any temporary migration oracle;
- the separate `ResearchWorkspace` implementation and factory;
- comparison-only code introduced by task 024;
- console/database startup arguments;
- documentation claims about durable evidence, reopening, or SQLite fallback;
  and
- tests whose only product requirement is persistence across close/reopen.

Do not remove underlying same-process capabilities merely because their old
tests used reopening. Rewrite those scenarios around the active process where
they still prove:

- canonical deduplication and independent observations;
- selection and account resolution;
- replaceable-event and relationship semantics;
- traversal and projection;
- acquisition coverage;
- runs;
- retained groups, reasons, expansion, and combination;
- sessions and checkpoints; and
- bounded corpus behavior.

Bulk mutations must validate and prepare before committing. Do not reproduce a
transaction API solely to imitate SQLite.

## Documentation

Update `CONTEXT.md`, package metadata, package README, workflow roadmap, console
help, and relevant comments to state:

- memory is a bounded process-local research corpus;
- persistence and database format are deliberately absent;
- closing, resetting, or ending the process loses resident state;
- retained groups, runs, and coverage exist only for the running process; and
- removing remaining Node dependencies is a separate future milestone.

Historical completed task definitions and committed field-trial artifacts are
historical records. Do not rewrite them merely because they describe the
architecture that existed when they ran.

## Boundaries

Do not add IndexedDB, OPFS, localStorage, snapshot import/export, a persistence
interface, storage adapter, browser bundler, worker, Rust/Wasm, or database
replacement.

Do not remove `node:fs`, `node:crypto`, `ws`, the console, or Node test
infrastructure unless a particular import is dead after SQLite deletion.

## Verification

- Run the complete functional suite and syntax checks.
- Search the production package for SQLite imports, SQL, database paths, and
  active workspace terminology.
- Run a real persistent-console process that creates a bounded corpus, imports
  fixtures, searches, traverses, inspects, retains a group, and exits.
- Confirm a fresh process starts empty; this is expected behavior, not a
  regression.
- Confirm the package dependency tree contains no SQLite package introduced as
  a replacement.

## Acceptance criteria

- Production code contains no SQLite implementation or SQL.
- No database path is required or exposed.
- Exactly one authoritative in-memory corpus owns resident evidence.
- Same-process research capabilities remain available.
- Persistence-specific tests and claims are removed without preserving
  accidental architecture.
- No replacement database or storage abstraction is introduced.
- Documentation and canonical context describe the new runtime truth.
- The complete functional suite, syntax checks, and console field verification
  pass.



# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/test/acquisition.functional.test.js:startRelay` requires `certificateDirectory`, but all callers now omit it after temporary-directory setup was removed. `join(undefined, ...)` causes nine functional tests to fail before networking begins. Restore a valid disposable certificate directory or otherwise provide certificate paths so the complete functional suite passes. This is not a loopback-listener sandbox failure.

2. The required task validation exits with code 1 because only 16 of 25 tests pass. Re-run and provide successful complete functional-suite, syntax, search, dependency, and console field verification after correcting the test failure.