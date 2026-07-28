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
acquire evidence, inspect it, navigate relationships, preserve useful collections,
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
  included in a query, relationship traversal, or named notebook membership.
- Persistence and a database format are deliberately absent. Closing or
  resetting memory, or ending the process, loses all resident state.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **address** | A canonical NIP-01 coordinate for current replaceable or addressable event state; it is a stable subject distinct from every immutable historical event ID. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The process-local owner of the observation buffer, evidence archive, research notebook, and their derived indexes. |
| **observation buffer** | The renewable, capacity-bounded store of canonical events recently acquired from relays, their observations, and temporary indexes. Buffer evidence may be evicted. |
| **evidence archive** | Deliberately preserved evidence copied from the observation buffer at an explicit preservation level. Archive evidence is not silently evicted to make room for relay acquisition. |
| **research notebook** | Explicit process-local research knowledge: subject judgments, labels, notes, named membership and selected derived observations with reasons and source references. It is interpretation, not Nostr source evidence. |
| **session** | The persistent declarative, in-process owner of named result handles and a revision over one process-local memory. |
| **research configuration** | The explicit effective settings for one memory and session: immutable engine constraints, construction-time capacities, mutable defaults for future commands, and per-command overrides. |
| **result handle** | A session-owned name for an engine view. Handles are replaceable navigation state and do not silently preserve canonical evidence. |
| **subject collection** | A bounded set of stable Nostr subjects with membership reasons and provenance. |
| **research relation** | A bounded composable view of stable subjects, derived values, reasons, and provenance. Source-backed fields resolve from the archive or buffer; a relation must not accidentally become an undocumented evidence archive. |
| **field lineage** | Lightweight relation metadata recording which earlier field produced a renamed or grouped value and, when known, whether that value is a stable account or event identifier. It assists navigation without interpreting the value itself. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
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
- provenance detail and notebook-membership semantics;
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

Research configuration has explicit precedence and ownership. Engine
constraints describe immutable supported ranges. Memory, archive, and notebook
capacities are chosen when memory is constructed because changing them can
evict or reject state. Session configuration supplies mutable defaults for
future acquisition and presentation. Explicit command parameters override
those defaults for one operation. Generic session configuration never resizes
memory or silently changes existing evidence.

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
consumes relation fields, so acquisition can be directed by the current
analysis rather than hidden inside task-specific workflows. Pure `extract`
crosses relation values into stable subjects; protocol continuation starts
only from an explicit subject collection.

Relation transformations retain field lineage when fields are renamed or used
as grouping keys. This allows a later `extract` operation to recover a known
account/event transition without inferring meaning from the new field name.
Lineage is metadata, not evidence or a general type system. Technical
presentation facts such as per-row truncation remain separate from ordinary
analysis values.

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
reports canonical non-matches separately. Nested relay requests inside one
continuation are deliberately absent: one acquisition command performs one
explicit bounded relay attempt. Multi-step research composes those attempts
sequentially and keeps each outcome visible.

Notebook queries and named memberships can be converted to ordinary subject
collections for later operations. They restore stable subjects and recorded
reasons without relay access or reconstruction of evicted canonical evidence.
Notebook judgments, labels, and notes can outlive eviction of the evidence they
reference, but disappear with `reset()`, `close()`, or process exit. Their
meaning remains provisional and attributed to the caller that recorded them.

Session status reports observation-buffer, archive, and notebook counts
separately, while handle listing reports working-view cardinality. After
buffer turnover, notebook collections remain composable, archived canonical
evidence still resolves, and excerpt-only or unpreserved references are
honestly unresolved. Releasing archive evidence changes resolution but not
notebook history; releasing handles changes neither; reset clears every owner
and handle.

The final public flow is sustained through one declarative session and its
JSONL executable: acquire explicitly, select locally, navigate subject
collections, cross into relations for value analysis, preserve only deliberate
evidence or attributed notebook knowledge, and inspect every bound and
omission. Contextual schema visibility and named inputs expose generic
operations for ordinary sequential research without executable JavaScript.
Profile claims, protocol metadata,
mechanical matches, and graph proximity remain evidence for researcher
judgment rather than implicit credibility or trust scores.

Protocol relationship derivation is kind-aware and remains a replaceable view
over canonical evidence. Kind-1 and kind-1111 thread edges alone form
conversations; repost, reaction, and deletion targets retain distinct
relationship types. Unknown event and account tags remain mechanical
references rather than inheriting NIP-10 meaning. The relationship vocabulary
and the groups used by collection movement and continuation have one owner, so
navigation cannot drift from ingestion semantics.


# Selected task

---
id: 058-nostr-reference-decoding
status: in_progress
max_attempts: 4
validation: workflow/tasks/058-nostr-reference-decoding.validate.sh
depends_on: 057-addressable-event-subjects
---

# Decode shareable Nostr references into stable subjects

## Goal

Let callers turn human-facing NIP-19 and NIP-21 references into the same
event, account, and address subjects already used by the research engine,
without treating transport hints as identity or silently contacting relays.

## Required work

1. Add one small authoritative reference-decoding boundary using the existing
   `nostr-tools` dependency rather than implementing bech32/TLV mechanics.
2. Accept the research-relevant NIP-19 entities:
   - `npub` and `nprofile` -> account subject;
   - `note` and `nevent` -> immutable event subject;
   - `naddr` -> address subject from task 057.
3. Accept the same entities when wrapped in a NIP-21 `nostr:` URI.
4. Reject private `nsec` material and unsupported or malformed entities with a
   bounded, semantic public error. Apply NIP-19's 5000-character input bound.
5. Return a structured decoded reference containing:
   - the stable subject;
   - the original reference form;
   - optional author, kind, and relay hints actually present in the encoding.
   Unknown TLV fields are ignored as required by NIP-19.
6. Keep hints attributed to the decoded reference. They must not alter subject
   identity, mutate session relay defaults, trigger acquisition, or be
   presented as verified facts.
7. Integrate decoded references into the smallest existing caller-input seams
   where a human or agent supplies a subject for resolution or inspection.
   Do not create alternate operations or duplicate collection semantics.
8. Expose the accepted reference forms and hint semantics factually through
   the existing schema and documentation.

## Acceptance criteria

- Equivalent hex, bare NIP-19, and `nostr:` forms resolve to the same stable
  subject.
- Relay hints do not participate in identity and are never followed
  automatically.
- `naddr` uses the canonical address rules from task 057.
- `nevent` author/kind hints remain visible but do not override canonical
  event evidence.
- Invalid, oversized, private, and unsupported inputs fail predictably.
- The implementation is a normalization boundary, not a new scripting,
  routing, or acquisition framework.

## Verification

- Permanent tests expected: yes.
- Stable public behavior protected: supported NIP-19/NIP-21 decoding,
  rejection boundaries, stable subject equivalence, and separation of hints
  from identity and session configuration.
- A single public-boundary functional scenario should cover representative
  entities and caller integration; do not test third-party bech32 internals.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: QR/rendering behavior, `nsec`, live relay access,
  automatic routing, browser protocol handlers, and UI.


# Previous independent review

CHANGES_REQUIRED

1. `src/reference.js:56-65` leaks `ResearchMemoryError` for decodable but non-canonical `naddr` values (for example kind `1`) instead of the decoder’s bounded `InvalidNostrReferenceError`. Normalize canonical-address failures at this public decoding boundary so malformed/unsupported references fail consistently and predictably.

2. `src/interpreter.js:1097,1107` only says “public reference.” The task requires the existing schema, as well as documentation, to expose accepted forms and hint semantics factually. Enumerate `npub`, `nprofile`, `note`, `nevent`, and `naddr`, and state that encoded author/kind/relay hints are unverified and never followed automatically.

# Worker report

Implemented both review findings.

Deliverables changed:
- Normalized canonical subject failures, including invalid `naddr` kinds, to `InvalidNostrReferenceError`.
- Expanded inspect/explain schema text with accepted entities and unverified, non-routing hint semantics.
- Updated functional schema expectations and reference rejection coverage.

Validation:
- Syntax checks passed.
- Complete functional suite passed: 22/22.
- `git diff --check` passed.

Permanent tests:
- Expanded public-boundary reference test to protect predictable rejection of decodable but non-canonical addresses.
- Expanded schema contract test to protect factual reference and hint documentation.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/protocol.js && node --check src/reference.js && node --check src/protocol-relationships.js && node --check src/configuration.js && node --check src/contract-facts.js && node --check src/memory.js && node --check src/collection.js && node --check src/acquire.js && node --check src/operations.js && node --check src/relation.js && node --check src/pipeline-source.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

✔ acquisition rejects unusable public inputs before networking (0.9185ms)
✔ address subjects navigate typed references to current local replaceable evidence (82.105375ms)
✔ ordinary acquisition accepts an explicit canonical #a filter (0.395416ms)
✔ direct, plan, and session execution share operation kinds and failure boundaries (38.035541ms)
✔ collections navigate identities while relations own value analysis (19.429458ms)
✔ named account and note handles continue with bounded relationship provenance (2229.454541ms)
✔ factual schemas construct commands accepted through the public session seam (48.990917ms)
✔ declarative observation and lifecycle form one bounded public workflow (45.031125ms)
✔ relation summaries compact source selection details without losing their shape (3.093792ms)
✔ declarative named results compose compatible sets and expose their schema (6.536917ms)
✔ declarative notebook knowledge survives turnover and remains independent from evidence (20.53775ms)
✔ explicit archive preservation survives complete buffer turnover and releases atomically (64.947833ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (38.248ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (18.606666ms)
✔ JSONL executable provides one persistent bounded process workflow (111.289959ms)
✔ process-local memory preserves canonical evidence and independent relay observations (29.739083ms)
✔ public references normalize to stable subjects while hints stay attributed metadata (4.661833ms)
✔ mixed event kinds derive truthful references without polluting conversations (47.437833ms)
✔ replaceable selection and follow interpretation remain stable in one process (25.224625ms)
✔ public local search composes constraints, explains matches, and preserves provenance (28.474708ms)
✔ relation handles resolve references across evidence lifetime and keep bounded views composable (54.557ms)
✔ large notebook membership is atomic, bounded, process-local, and directly navigable (2272.576875ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2553.369291


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.