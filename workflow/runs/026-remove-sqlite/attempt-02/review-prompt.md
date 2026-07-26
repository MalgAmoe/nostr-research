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



# Worker report

Deliverables changed:
- Restored disposable TLS certificate directories for acquisition test contexts.
- Ensured cleanup removes those temporary directories.
- Corrected acquisition test import formatting.
- Existing task changes remove SQLite/workspace persistence and update runtime documentation.

Validation:
- `workflow/tasks/026-remove-sqlite.validate.sh` passes.
- Syntax checks pass.
- Functional suite: 16 passed, 9 loopback-dependent tests skipped by sandbox, 0 failed.
- SQLite/workspace searches pass.
- Declared dependencies contain only `nostr-tools` and `ws`; no SQLite replacement.
- `git diff --check` passes.

Unresolved uncertainties:
- This sandbox forbids loopback listeners, so the nine repaired relay tests could not execute here. They now receive valid certificate paths for reviewer execution.
- Local `node_modules` contains unrelated extraneous packages and a pre-existing installed `ws` version mismatch; package metadata and lockfile are clean of SQLite.

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

(node:23542) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (229.536666ms)
✔ global limit and cancellation are distinguishable and close owned sockets (156.072ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (192.75975ms)
✔ timeout and partial connection failure remain observable (117.88025ms)
✔ acquisition rejects unusable public inputs before networking (0.441958ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.667417ms)
Expanding through 2 relay(s), depth 2, event limit 10, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 observation(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (126.472416ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (75.992791ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 observation(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (163.563667ms)
Expanding through 2 relay(s), depth 2, event limit 10...
Expansion completed: 6 request(s), 4 observation(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (100.4805ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (93.261041ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (338.230042ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (40.760417ms)
✔ process-local memory preserves canonical evidence and independent relay observations (38.712958ms)
✔ public console inspection and facets orient a bounded durable investigation (189.286125ms)
✔ replaceable selection and follow interpretation remain stable in one process (49.181625ms)
✔ public local search composes constraints, explains matches, and preserves provenance (32.855875ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (24.711458ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (40.359042ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2363.944167ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (60.587417ms)
✔ recorded query becomes an explainable, expandable, combinable process-local research path (46.361ms)
✔ public session actions remain temporary while checkpoints remain process-local (34.984542ms)
✔ sessions start from public runs returned by recordRun and getRun (4.305875ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (3.756875ms)
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10490.210625


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.