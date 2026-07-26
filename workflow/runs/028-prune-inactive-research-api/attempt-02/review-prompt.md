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
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **retained selection** | A deliberately retained, named result collection with its subjects and reasons for later inspection during the running process. |
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
- provenance detail and retained-selection semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the only authoritative corpus. A session coordinates selection, focus,
exclusions, history, and temporary branches over memory operations. A result
collection is the shared operation result passed between these layers. A retained
selection is a process-local checkpoint. Retained selections disappear with the
corpus. Sessions and branches are not serialized.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
returns bounded acquisition coverage directly to the caller. Coverage says
that a precise relay/filter/budget attempt occurred. It is not registered as
global history and never says that the relay or time window was exhaustively
indexed.

Removing the remaining Node dependencies is a separate future milestone.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.

Acquisition exposes separate operation-wide bounds for accepted valid relay
observations and distinct canonical event IDs. Duplicate observations consume
the observation budget but not the distinct-event budget. Reports keep
received packets, accepted observations, duplicate observations, newly stored
corpus events, and distinct events acquired separate, and identify which bound
stopped an operation.


# Selected task

---
id: 028-prune-inactive-research-api
status: in_progress
max_attempts: 5
validation: workflow/tasks/028-prune-inactive-research-api.validate.sh
depends_on: 027-explicit-acquisition-budgets
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Prune inactive research records and shallow APIs

## Objective

Reduce the library to the capabilities exercised by the current research loop:
bounded evidence, observations, local selection, account resolution, protocol
relationships, traversal, acquisition, expansion, reply contexts, and retained
selections.

Delete abstractions whose complexity disappears when they are removed. There
is no legacy compatibility requirement for this experimental package.

## Remove

- process-local research runs, including recording, lookup, listing,
  normalization, subjects, projection, session initialization, and run-to-set
  conversion;
- the global acquisition-coverage registry and its record/get/list/query
  methods;
- generic set construction, member mutation, member explanation, set
  expansion, and set algebra;
- the core `load` alias;
- the lower-level public `searchEvents` result shape when `select` supplies the
  compositional collection;
- fixed `relatedEvent` and `relatedAccount` wrappers around resolve/traverse;
  and
- the duplicate `summary` method when `describe` is authoritative.

## Preserve

- Complete coverage information returned directly by every acquisition. It
  must still describe the request, budgets, relay outcomes, observations,
  uncertainty, and completion without registering a global history record.
- Observation provenance stored with resident canonical events.
- Result collections and their reasons/context.
- Retaining an explicit result collection with reasons.
- Reading, listing, renaming, and deleting retained selections.
- Traversal, thread interpretation, inspection, projection, expansion, and
  reply-context behavior that does not depend on removed record types.
- Atomic validation of retained selections.

Update subject validation, reset/close behavior, presentation, session
adaptation, documentation, exports, and tests so removed concepts do not remain
as dormant compatibility branches.

## Boundaries

- Do not replace runs or coverage history with another history abstraction.
- Do not introduce repository, service, storage, or adapter layers.
- Do not reorganize files merely to reduce line counts.
- Do not remove returned acquisition coverage or retained selections.
- Delete tests that only preserve removed interfaces. Keep functional coverage
  of the surviving research loop and focused protocol rules.

## Acceptance criteria

- The removed methods and record/subject types are absent from active source,
  exports, README, and canonical context.
- Acquisition still returns complete attempt coverage without storing an
  attempt registry in the corpus.
- A caller can acquire, select, traverse, inspect, expand, resolve reply
  contexts, retain a collection, and reopen that retained selection within the
  same process.
- The public core surface has one canonical local event-selection operation.
- No replacement architecture or compatibility facade is introduced.
- Functional tests and syntax checks pass.


# Worker report

Deliverables changed:
- Added relay provenance to `coverage.observedEvents`.
- Removed acquisition coverage record IDs from presentation output.
- Added functional validation for per-observation relay provenance.

Validation:
- Task validation script passed.
- Syntax checks passed.
- Tests: 12 passed, 0 failed, 10 network tests skipped due to sandbox loopback restrictions.
- `git diff --check` passed.

Unresolved uncertainties:
- Network-dependent tests could not run in this sandbox.

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

(node:35254) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (199.299458ms)
✔ global limit and cancellation are distinguishable and close owned sockets (129.474541ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (99.966292ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (157.799625ms)
✔ timeout and partial connection failure remain observable (245.622583ms)
✔ acquisition rejects unusable public inputs before networking (0.413583ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.552958ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (98.588209ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (116.878ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (141.3905ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (64.090833ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (151.063959ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (273.607875ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (24.672292ms)
✔ process-local memory preserves canonical evidence and independent relay observations (32.608583ms)
✔ presentation and facets orient surviving research values (48.378375ms)
✔ replaceable selection and follow interpretation remain stable in one process (60.108334ms)
✔ public local search composes constraints, explains matches, and preserves provenance (38.070542ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (20.739084ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2323.305542ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (46.668709ms)
✔ public session actions remain temporary while checkpoints remain process-local (29.334583ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10426.459375


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.