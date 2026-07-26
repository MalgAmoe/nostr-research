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
| **session** | The temporary, in-process owner of the console's explicitly activated selection and its last meaningful state action. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **retained selection** | A deliberately retained, named result collection with its subjects and reasons for later inspection during the running process. |
| **annotation** | A process-local interpretation attached to a stable subject: caller-defined labels and a free-text note. It is navigation state, not source evidence or a universal claim. |
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

Memory is the only authoritative corpus. A session owns only the console's
explicitly activated selection and its last state action. All query,
acquisition, expansion, reply-context, filtering, facet, comparison,
inspection, and traversal operations return values without changing that
selection. Activation is a separate explicit operation. Retaining a supplied
result and checkpointing the active selection are distinct operations. A result
collection is the shared operation result passed between these layers. Retained
selections disappear with the corpus; sessions are not serialized.

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

Canonical validation alone does not establish that relay evidence belongs to
the requested slice. Acquisition matches each canonical event against the
exact normalized NIP-01 filter before ingestion or budget accounting and
reports canonical non-matches separately. For composed expansion and
reply-context operations, the distinct-event bound is shared across nested
requests, so a repeated ID consumes distinct capacity only on its first
appearance.

Explicit session activation accepts both retained summaries and full retained
selections through the same retained-to-collection conversion. It restores
subjects and retained reasons without relay access or reconstruction of
evicted canonical evidence.

Annotations belong to memory's replaceable derived material. They can outlive
eviction of the canonical event or profile they reference, but disappear with
`reset()`, `close()`, or process exit. Annotation labels have only the meaning
assigned by their caller.


# Selected task

---
id: 032-stable-subject-collections
status: in_progress
max_attempts: 4
validation: workflow/tasks/032-stable-subject-collections.validate.sh
depends_on: 031-production-interface-cleanup
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md
reviewer_sandbox: workspace-write
---

# Make collections stable by subject identity

## Objective

Correct the collection identity flaw exposed by Trial 4 before adding a
declarative operation layer.

Collections must remain meaningful when the canonical evidence for one of
their subjects gains observations, changes current replaceable metadata, or is
evicted. Stable subject identity, reasons, and evidence references are the
durable collection state. Canonical records are resolved from the current
corpus when an operation needs them.

## Required behavior

- A collection selected before a duplicate event is observed on another relay
  remains accepted by all collection operations afterward.
- A collection containing an account remains accepted after newer kind-0
  metadata or additional provenance is ingested.
- Resident operations use the current canonical event or profile rather than
  a stale embedded snapshot.
- A retained subject remains inspectable after eviction and explicitly reports
  that resident evidence is absent.
- Public callers cannot fabricate canonical event/profile evidence or
  provenance by constructing a collection item.
- Reasons attached to a collection item survive re-resolution.

## Consistent access

Provide one direct exact-subject lookup/selection path for event and account
subjects so callers do not query hundreds of accounts and filter by ID in
JavaScript. Keep raw inspection and its console presentation consistent about
the `resident` state.

Do not add prefix aliases or broad convenience search APIs.

## Boundaries

- Do not add the declarative plan language in this task.
- Do not add persistence, a database abstraction, Rust, or a UI.
- Do not remove provenance, evidence, reasons, annotations, or bounded
  eviction.
- Prefer deleting embedded-record validation/state when stable resolution
  makes it unnecessary; do not add a versioning framework.
- Add one focused functional regression scenario covering stale collections,
  current resolution, and eviction. Do not add unit tests for individual
  helpers or object shapes.

## Acceptance criteria

- The exact Trial 4 failure mode no longer occurs.
- Collection operations resolve current resident evidence by subject identity.
- Exact event/account access does not require a broad query plus handwritten
  filtering.
- Inspection consistently distinguishes resident evidence from a retained
  reference.
- Existing functional behavior remains intact.
- Documentation describes collections as subject/reason references rather than
  immutable embedded canonical records.
- Functional tests and syntax checks pass.


# Worker report

Implemented review fixes.

Deliverables changed:

- `presentation.js`: collection display now consistently uses re-resolved evidence and provenance.
- Functional regression: reproduces Trial 4 using a pre-duplicate selected snapshot, verifies updated event/account presentation, preserved reasons, and post-eviction inspection.

Validation:

- Focused functional tests: 2 passed.
- Full syntax checks: passed.
- Full test suite: 14 passed, 13 network tests skipped due to sandbox restrictions, 0 failed.

Unresolved uncertainties: none.

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

(node:59506) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (115.003625ms)
✔ account hydration derives a bounded metadata filter from account subjects (114.634792ms)
✔ global limit and cancellation are distinguishable and close owned sockets (109.766ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (84.214958ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (61.398875ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (160.370792ms)
✔ timeout and partial connection failure remain observable (183.723959ms)
✔ acquisition rejects unusable public inputs before networking (0.541416ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.521208ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (81.848583ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (71.303375ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (71.683584ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (138.86425ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (79.326542ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (87.598875ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (285.403833ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (21.314ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (12.360166ms)
✔ process-local memory preserves canonical evidence and independent relay observations (41.498917ms)
✔ presentation and facets orient surviving research values (43.709459ms)
✔ replaceable selection and follow interpretation remain stable in one process (65.992667ms)
✔ public local search composes constraints, explains matches, and preserves provenance (41.76025ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (23.207625ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2273.826875ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (40.90075ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (27.928041ms)
✔ retained reactivation does not recreate evicted canonical evidence (6.195583ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10449.144


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.