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

The public research core is runtime-neutral and uses Web Platform primitives,
including the runtime's standard `WebSocket`, `TextEncoder`, Web Crypto,
timers, and abort signals. Acquisition has one implementation across direct,
plan, session, hydration, continuation, and relation-backed fetch execution;
runtime capabilities are not command parameters or serialized research state.
The JSONL executable remains a Node adapter that owns streams, process
arguments, signals, and CLI diagnostics.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.

NIP-11 inspection is one explicit input-free external operation over selected
relay URLs. It uses the runtime's standard fetch, returns one bounded attributed
retrieval outcome per relay, and may be held only as an ephemeral factual
session view. It does not mutate the observation buffer, archive, or notebook;
it is not acquisition coverage, and ordinary acquisition never performs a
hidden relay-information request. Advertised authentication requirements
remain claims and do not establish an acquisition refusal.

NIP-45 count is a separate explicit input-free external operation for one
exact normalized filter over selected relay URLs. Its bounded report preserves
one exact or approximate response, protocol evidence, refusal, diagnostic, or
failure outcome per relay. Counts are never summed across overlapping relay
corpora, counting does not mutate research memory, and it performs neither
hidden acquisition nor hidden NIP-11 inspection.

Acquisition exposes separate operation-wide bounds for accepted valid relay
observations and distinct canonical event IDs. Duplicate observations consume
the observation budget but not the distinct-event budget. Reports keep
received packets, accepted observations, duplicate observations, newly stored
corpus events, and distinct events acquired separate, and identify which bound
stopped an operation.

Relay acquisition reports connection-level `NOTICE` and `AUTH` packets
separately from subscription-scoped packets. Per-relay diagnostics are bounded
and retain omission counts. Outcomes distinguish failure before opening,
opened-peer closure, explicit `CLOSED` refusal, EOSE completion, and
operation-wide bounds. Standardized refusal prefixes and NIP-67 `finish` or
`more` hints retain bounded raw evidence, but neither EOSE nor a hint claims
global exhaustiveness. An observed authentication challenge is neutral
transport evidence; only an `auth-required:` refusal establishes that request
outcome, and acquisition never signs or answers a challenge.

Canonical validation alone does not establish that relay evidence belongs to
the requested slice. Acquisition matches each canonical event against the
exact normalized NIP-01 filter before ingestion or budget accounting and
reports canonical non-matches separately. Nested relay requests inside one
continuation are deliberately absent: one acquisition command performs one
explicit bounded relay attempt. Multi-step research composes those attempts
sequentially and keeps each outcome visible.

Relay acquisition excludes directly self-warned content by default after
canonical validation and exact filter matching but before budgets and
ingestion. A direct `content-warning` tag or a self-label in the
`content-warning` namespace triggers the exclusion; its report retains only a
count. Callers may explicitly disable the setting. Kind-1985 labels and
kind-1984 reports remain attributed third-party evidence and never become
hidden acquisition policy. Direct `memory.ingest()` remains policy-free.

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
id: 072-truthful-relation-accounting
status: in_progress
max_attempts: 4
validation: workflow/tasks/072-truthful-relation-accounting.validate.sh
depends_on:
---

# Truthful relation cardinality and bound accounting

## Context

A sustained CLI trial exposed a real honesty defect in intermediate relation
handles. Two input events with 160 total tags, exploded with the default limit
of 100, produce a 100-row handle whose current metadata says:

```text
inputCount: 2
outputCount: 100
omittedCount: 0
coverage.partial: false
```

The generic formula `max(0, input rows - output rows)` is not meaningful for
operations that expand, collapse, deduplicate, filter, join, or window rows.
The engine records the configured limit but can lose the fact that an
operation stopped because of it.

## Goal

Every relation stage must expose factual cardinality and limit information
whose units and meaning remain correct for that operation.

## Work

1. Remove the executor's generic derivation of semantic `omittedCount` from
   input and output row counts.
2. Keep a small common accounting core with explicit row units:
   - input rows;
   - output rows;
   - the applicable output limit, when one exists;
   - whether an additional qualifying output was observed beyond that limit.
3. Set `truncated: true` only when the operation knows that at least one
   qualifying output was not retained. Output count equalling the limit is not
   by itself proof of truncation.
4. Report an exact omitted-by-limit count only when the operation already
   knows it without inventing or conflating facts. It is acceptable to report
   known truncation without an exact omitted count.
5. Let each relation operation supply only the additional accounting that
   accurately describes its semantics:
   - predicate rejection is distinct from limit truncation;
   - duplicate removal is distinct from limit truncation;
   - aggregation reports produced/retained groups rather than treating row
     collapse as omission;
   - slicing reports its source total and selected window;
   - balancing reports per-key rejection separately from a global bound;
   - expanding operations such as explode, scan, and join detect an additional
     qualifying output rather than silently returning at the bound.
6. Preserve this accounting through relation context, handle storage,
   contextual schema where applicable, and `show summary` / `show coverage`.
7. Keep the implementation direct. Do not introduce a validation language,
   generic metrics framework, alternate executor, or operation hierarchy.
8. Update durable package documentation only where the public accounting
   contract changes.

## Acceptance criteria

- An explode with 160 possible rows and limit 100 reports 100 output rows and
  `truncated: true`.
- An operation producing exactly its limit with no additional candidate does
  not claim truncation.
- Filtering rejected rows is not mislabeled as bound omission.
- Aggregation row collapse is not mislabeled as omission.
- Window, deduplication, balancing, expansion, and join accounting use factual
  operation-specific meanings.
- Immediate handle metadata remains concise; bounded facts are observable
  through the existing session and presentation boundary.
- Plans and individual commands still use the same executor.
- Existing commands and composition remain compatible unless an old field was
  actively false; any such correction is documented explicitly.

## Non-goals

- Uniform summaries across every handle kind; that is Task 073.
- Relay transport changes.
- Exact total expansion counts when the engine would otherwise stop early.
- New research operations or task-specific shortcuts.
- Raising relation or memory limits.

## Verification

- Permanent tests expected: yes, by extending the existing public relation
  functional coverage rather than adding operation-by-operation unit tests.
- Stable public behavior protected: truthful expansion truncation, a
  non-truncated exact-limit case, filter semantics, aggregate semantics, and
  observation of the accounting through a named session handle.
- Temporary task validation or field evidence: reproduce the two-event,
  160-tag, default-limit case through the public session.
- Explicitly excluded test levels or mechanisms: private-helper imports,
  snapshots of entire response objects, live relays, browser automation, and a
  separate test for every relation operation.


# Worker report

Implemented truthful relation cardinality and bound accounting.

Deliverables changed:

- Relation operations now report factual row accounting and proven truncation.
- Filtering, deduplication, aggregation, slicing, balancing, joins, scans, and explosions expose operation-specific facts.
- `omittedCount` is only emitted when exact limit omission is known.
- Accounting is preserved through relation contexts, schemas, session handles, `show summary`, and `show coverage`.
- Public accounting contract documented in the package README.

Validation:

- `npm run check` passed.
- Full `npm test` passed: 32/32 tests.
- `git diff --check` passed.
- Task validation script passed.

Permanent tests expanded:

- Public relation/session functional coverage now protects the 160-to-100 explode truncation case, exact-limit non-truncation, filter rejection semantics, aggregation collapse semantics, and named-handle accounting visibility.
- Existing relation-summary coverage was updated for the newly public initial cardinality facts.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/protocol.js && node --check src/reference.js && node --check src/protocol-relationships.js && node --check src/event-content.js && node --check src/relay-url.js && node --check src/configuration.js && node --check src/contract-facts.js && node --check src/memory.js && node --check src/collection.js && node --check src/acquire.js && node --check src/relay-info.js && node --check src/relay-count.js && node --check src/operations.js && node --check src/relation.js && node --check src/pipeline-source.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check src/browser-worker.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

✔ relation fetch binds deduplicated values into an ordinary acquisition (14.889667ms)
✔ acquisition rejects unusable public inputs before networking (0.361625ms)
✔ relay acquisition excludes direct self-warnings by default with a factual override (68.663416ms)
✔ public acquisition and session reports preserve bounded relay messages and honest outcomes (87.499375ms)
✔ address subjects navigate typed references to current local replaceable evidence (81.084666ms)
✔ ordinary acquisition accepts an explicit canonical #a filter (0.420833ms)
✔ direct, plan, and session execution share operation kinds and failure boundaries (39.0045ms)
✔ collections navigate identities while relations own value analysis (15.321583ms)
✔ relation handles report operation-specific cardinality and proven truncation (279.51025ms)
✔ named account and note handles continue with bounded relationship provenance (2321.535958ms)
✔ factual schemas construct commands accepted through the public session seam (52.541417ms)
✔ declarative observation and lifecycle form one bounded public workflow (45.452584ms)
✔ relation summaries compact source selection details without losing their shape (7.398292ms)
✔ declarative named results compose compatible sets and expose their schema (7.9495ms)
✔ declarative notebook knowledge survives turnover and remains independent from evidence (20.455625ms)
✔ relations normalize bounded attachment evidence and generically explode objects (282.022291ms)
✔ relations expose lazy factual event content and conversation fields (90.112958ms)
✔ explicit archive preservation survives complete buffer turnover and releases atomically (69.248083ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (25.209167ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (25.269917ms)
✔ JSONL executable provides one persistent bounded process workflow (85.1535ms)
✔ process-local memory preserves canonical evidence and independent relay observations (25.938709ms)
✔ public references normalize to stable subjects while hints stay attributed metadata (3.131167ms)
✔ mixed event kinds derive truthful references without polluting conversations (98.333542ms)
✔ inline NIP-27 references navigate as typed, explainable evidence without becoming threads (13.438667ms)
✔ replaceable selection and follow interpretation remain stable in one process (27.340708ms)
✔ public local search composes constraints, explains matches, and preserves provenance (29.707333ms)
✔ relation handles resolve references across evidence lifetime and keep bounded views composable (63.45725ms)
✔ relay count remains attributed and never creates a global total (8.840666ms)
✔ relay count cancellation distinguishes started and unstarted attempts (0.435583ms)
✔ relay information stays attributed, bounded, and reusable through the public executor (10.761584ms)
✔ large notebook membership is atomic, bounded, process-local, and directly navigable (2264.40375ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2668.668292


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.