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

Treat the durable principles in `CONTEXT.md` as constraints on every task.
Historical completed tasks do not override current policy. Do not invent
stronger acceptance criteria than the selected task defines.

Audit test changes as carefully as production changes:

- Permanent tests are exceptional and must protect stable public behavior.
- Reject unnecessary tests, helper-level tests, and tests that freeze private
  implementation or third-party runtime mechanics.
- Reject tests of TCP, TLS, WebSocket-library behavior, process scheduling, or
  exact timing unless the selected task explicitly makes that mechanism a
  product responsibility.
- Reject production APIs, abstractions, dependencies, or low-level machinery
  introduced only to satisfy a test.
- Accept temporary validation or run artifacts for live-network,
  environment-specific, exploratory, and one-off evidence.
- Passing validation is not evidence that every test is worth keeping.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish or expand the task.

Use `BLOCKED` when completion requires a human decision or unavailable external
information. Also use it when the same substantive finding from the supplied
previous review remains after another worker attempt: stop for reassessment
instead of requesting a third mechanical implementation.


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

- Memory is one process-local research environment shared by the library, CLI,
  functional verification, and future applications. It owns a renewable,
  capacity-bounded observation buffer, deliberately preserved evidence, and
  explicit research knowledge. These have different lifetimes and must not be
  conflated.
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
| **memory** | The process-local owner of the observation buffer, evidence archive, research notebook, and their derived indexes. |
| **observation buffer** | The renewable, capacity-bounded store of canonical events recently acquired from relays, their observations, and temporary indexes. Buffer evidence may be evicted. |
| **evidence archive** | Deliberately preserved evidence copied from the observation buffer at an explicit preservation level. Archive evidence is not silently evicted to make room for relay acquisition. |
| **research notebook** | Explicit process-local research knowledge: subject judgments, labels, notes, retained membership and selected derived observations with reasons and source references. It is interpretation, not Nostr source evidence. |
| **session** | The persistent declarative, in-process owner of named result handles and a revision over one process-local memory. |
| **result handle** | A session-owned name for an engine view. Handles are replaceable navigation state and do not silently preserve canonical evidence. |
| **subject collection** | A bounded set of stable Nostr subjects with membership reasons and provenance. |
| **research relation** | A bounded composable view of stable subjects, derived values, reasons, and provenance. Source-backed fields resolve from the archive or buffer; a relation must not accidentally become an undocumented evidence archive. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **retained selection** | Named notebook membership preserving stable subjects and reasons. Preserving the source evidence itself is a separate, explicit choice. |
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

Memory is the process-local owner of three distinct kinds of state:

- the observation buffer owns canonical relay events, observations, and
  temporary indexes, and may evict them according to its explicit capacity;
- the evidence archive owns only material deliberately preserved as a
  reference, bounded excerpt, or complete canonical event;
- the research notebook owns explicit interpretation and navigation knowledge,
  including judgments, labels, notes, memberships, reasons, and source
  references.

Resolution reports whether evidence came from the archive, the buffer, or is
currently unresolved. Ordinary acquisition never silently grows the archive
or notebook. Buffer eviction never silently deletes archived evidence or
notebook knowledge. Archive and notebook limits fail explicitly rather than
silently discarding research state.

A session is the persistent declarative research session: it owns named result
handles and a revision over one process-local memory. Commands name their
inputs and outputs explicitly; there is no active or current selection. A
result collection is the shared operation result passed between the library
and session layers. Handles remain views and do not silently copy complete
events. All state disappears on reset, close, or process exit; sessions are
not serialized.

The coherent product path is memory, subject collections and research
relations, normalized operations, the declarative session, and its JSONL
adapter. Operation names and result kinds have one
authoritative definition shared by validation, execution, session handles,
schema output, and presentation. `show`, `inspect`, and `explain` remain one
deep bounded-observation module over those real result shapes; presentation
does not define alternate domain results or compatibility shapes.

Named plans and individual session commands share the same operation
representation. A command may name one `input` or a map of named `inputs`;
multi-input analysis is therefore available during an iterative session and
does not require a static plan or executable JavaScript. Relay-backed `fetch`
and relationship `expand` consume relation fields, so acquisition can be
directed by the current analysis rather than hidden inside task-specific
workflows.

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
reports canonical non-matches separately. A continuation that performs nested
relay requests shares one distinct-event bound across those requests, so a
repeated ID consumes distinct capacity only on its first appearance.

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
id: 049-research-notebook
status: in_progress
max_attempts: 4
validation: workflow/tasks/049-research-notebook.validate.sh
depends_on: 048-deliberate-evidence-preservation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Consolidate explicit research knowledge in one notebook

## Objective

Give provisional interpretation and navigation knowledge one coherent owner.
The notebook must retain what the researcher learned without pretending that
subject membership or judgment preserves the underlying Nostr evidence.

## Work

- Replace the separate annotation map and retained-set implementation with one
  memory-owned research notebook following
  `workflow/artifacts/research-memory-milestone.md`.
- Support the useful existing actions through the coherent model:
  - interested, uninterested, uncertain, and anchor judgments;
  - optional strength, labels, and researcher-authored notes;
  - named subject membership with reasons and source references;
  - explicitly recorded bounded derived observations or summaries when a
    caller chooses to remember them.
- Keep notebook statements attributed and provisional. Do not infer, train,
  score, or automatically record every result.
- Make notebook queries usable as ordinary inputs to filtering, joining,
  explanation, and later relay-directed acquisition.
- Keep evidence preservation orthogonal:
  - notebook membership must not archive an event;
  - archiving evidence must not silently create a judgment;
  - deleting either must not silently delete the other.
- Provide a concise declarative/session lifecycle for listing, inspecting,
  replacing, and deleting notebook entries or named membership.
- Remove superseded annotation/set shapes, lifecycle branches, presentation,
  exports, documentation, and tests. There is no compatibility requirement.

## Acceptance criteria

- Notebook knowledge survives complete observation-buffer turnover.
- Positive and negative judgments and named candidate membership can direct a
  subsequent local or relay-backed operation without manual ID copying.
- Every notebook entry exposes its subject, kind, reason, attribution, and
  source references without claiming that referenced evidence is resolved.
- Notebook and archive lifecycles are independent and unambiguous.
- Existing research actions remain expressible with a smaller conceptual
  surface than annotations plus retained sets.
- No universal quality model, automatic classifier, persistence layer, or
  event duplication is added.

## Verification

- Permanent tests expected: yes, extend one public declarative-session
  workflow to protect notebook judgment, named membership, evidence
  independence, and use as a later operation input.
- Stable public behavior protected: provisional judgments, explainable
  membership, named result/session lifecycle.
- Temporary task validation or field evidence: deterministic acquire,
  remember, turn over, and reacquire scenario.
- Explicitly excluded test levels or mechanisms: tests per notebook command,
  internal map shape, scoring/classification tests, live relay transport, UI,
  persistence, and compatibility tests for removed annotation/set APIs.


# Worker report

Implemented task 049’s research notebook consolidation.

Deliverables changed:

- Replaced annotations and retained sets with memory-owned notebook entries and named memberships.
- Added provisional judgments, attribution, reasons, source references, labels, notes, strength, and bounded summaries.
- Added declarative notebook querying, remembering, forgetting, membership inspection/replacement/deletion, and later-operation reuse.
- Kept notebook and evidence archive lifecycles independent.
- Removed superseded commands, APIs, subject shapes, schema, presentation, and documentation.
- Updated public documentation.

Validation:

- Task validation script passed.
- All 21 tests passed.
- Syntax checks and `git diff --check` passed.

Permanent test expanded:

- Extended the public declarative-session workflow to protect positive/negative judgments, explainable named membership, buffer-turnover survival, archive independence, and notebook/membership reuse as later operation inputs.
- This stable lifecycle behavior warranted permanent coverage because temporary validation would not protect the cross-store independence contract.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/operations.js && node --check src/relation.js && node --check src/pipeline-source.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

✔ acquisition rejects unusable public inputs before networking (0.933125ms)
✔ typed local stages and composable relations refine trial-shaped evidence (61.606292ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.880708ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (14.721083ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.385917ms)
✔ stable bounds and compatible set composition share the public pipeline algebra (18.617958ms)
✔ pipeline schema exposes literal fields and preflight rejects invalid composition (2.829791ms)
✔ bounded groups preserve complete derived inputs and provenance for aggregation (8.222292ms)
✔ named account and note handles continue with bounded relationship provenance (2190.576916ms)
✔ declarative observation and lifecycle form one bounded public workflow (40.604084ms)
✔ declarative show bounds grouped and summarized named results (7.497792ms)
✔ declarative named results compose compatible sets and expose their schema (5.112208ms)
✔ declarative notebook knowledge survives turnover and remains independent from evidence (7.654042ms)
✔ explicit archive preservation survives complete buffer turnover and releases atomically (68.223208ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (30.821792ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (23.399791ms)
✔ JSONL executable provides one persistent bounded process workflow (102.211166ms)
✔ process-local memory preserves canonical evidence and independent relay observations (51.715959ms)
✔ replaceable selection and follow interpretation remain stable in one process (53.018792ms)
✔ public local search composes constraints, explains matches, and preserves provenance (22.194792ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2233.802125ms)
ℹ tests 21
ℹ suites 0
ℹ pass 21
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2444.738


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.