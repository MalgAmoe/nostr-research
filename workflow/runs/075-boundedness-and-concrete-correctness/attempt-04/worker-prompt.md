# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative within the
durable principles in `CONTEXT.md`. Historical completed tasks are evidence of
past work, not current policy.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.
Do not stage or commit changes; the runner owns the task commit after review.

If a previous review is supplied, address every applicable finding explicitly.
Do not implement a finding blindly when it conflicts with `CONTEXT.md`, expands
the selected task, or would add production complexity only to satisfy a test.
Explain that conflict in the worker report so the reviewer can assess it.
Do not merely describe work that should be done: perform the task within its
stated permissions.

## Verification discipline

Permanent tests are exceptional durable product code, not an automatic
deliverable for every feature or bug.

- Follow the testing policy in `CONTEXT.md`.
- Prefer a small public-boundary functional scenario over helper-level tests.
- Add a permanent test only when it protects stable, important behavior that is
  expensive or risky to verify otherwise.
- Do not test TCP, TLS, WebSocket-library mechanics, process scheduling,
  private state, private helpers, or exact timing unless that mechanism is
  explicitly the product behavior selected by the task.
- Use task validation or a run artifact for exploratory, live-network,
  environment-specific, and one-off verification.
- If a proposed test requires new public API, abstraction, dependency, or
  low-level production machinery, challenge the test before changing the
  product.
- Existing tests are not requirements by themselves. Remove or update a test
  when the selected product behavior intentionally changes.

When permanent tests are added or materially expanded, the final report must
name the stable public behavior each one protects and why temporary validation
was insufficient.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
- permanent tests added or expanded, with their justification, or `none`;
- unresolved uncertainties.


# Canonical project context

# Project context

## Purpose

Nostrarium is a project for research, navigation, and exploration of Nostr. It
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
| **navigator** | The human or agent operating a vessel and making every research decision. |
| **vessel** | A coherent, named research posture adopted by a navigator over the existing engine and session. It shapes attention and movement without owning facts or conclusions. |

## Vessels

A vessel is a coherent, named way of moving through the Nostr field on top of
the research engine. It is operated by a navigator—a human or an agent—who
makes every research decision.

A vessel is not an engine feature, a UI, an autonomous actor, or a subset of
the operation vocabulary. It is a complete research posture expressed through
caller-side conventions over the existing session: configuration defaults,
habitual operations, observation modes, judgment practices, and a collection
goal. Most vessels may use most of the engine.

A vessel couples four dimensions:

1. **Movement** — how the navigator acquires and traverses the field: breadth
   versus depth, acquisition habits, preferred navigation primitives, and the
   routes made attractive at each point.
2. **Senses** — which observations, projections, and presentation modes
   habitually frame the evidence encountered by the navigator.
3. **Judgment** — the practices and tempo through which the navigator forms
   notebook knowledge. Judgment always belongs to the navigator; the vessel
   shapes what is seen, in what order, and with what framing.
4. **Collection** — the shape and intent of the knowledge the navigator is
   trying to accumulate toward an eventual exportable artifact.

These dimensions form a loop with the navigator at its center: senses inform
judgment, judgment steers movement, and movement determines what the senses
encounter next. A distinct vessel deliberately changes at least one dimension
while keeping the whole loop coherent. Two vessels use the same engine,
operations, and session protocol, but should lead the same navigator through
measurably different journeys over the same field.

Ownership remains explicit:

```text
engine     owns what is true
vessel     owns what is attended to
navigator  owns what is concluded
```

Vessels live entirely on the caller side. The engine, session, schema, and
operation vocabulary do not know they exist. A vessel may arrange and
foreground factual engine results, but it never computes domain facts, ranks
by its own authority, or acts on the navigator's behalf. Any remembering or
preservation remains an explicit engine operation directed by the navigator;
the vessel owns no hidden research memory.

A vessel is disposable and implies a way of visualizing evidence even before
that presentation exists. Its exact lifetime, interaction model, degree of
factual observation assistance, and concrete presentation are deliberately
open. They will be discovered by building and using vessels, then promoting
only repeated findings into the durable model.

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

Per-relay acquisition coverage also retains the observed attempt lifecycle:
whether a worker started the attempt, whether the WebSocket opened, whether
the Nostr subscription request was sent, packets received, observations
accepted, and the final outcome. An unstarted relay, a pre-open stop, and an
opened subscription with zero packets remain distinguishable. Zero packets
does not imply that a relay was slow, silent, or late.

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
id: 075-boundedness-and-concrete-correctness
status: in_progress
max_attempts: 4
validation: workflow/tasks/075-boundedness-and-concrete-correctness.validate.sh
depends_on:
---

# Bound observation provenance and fix concrete execution inconsistencies

## Context

The observation buffer is bounded by distinct event count, but every repeated
ingestion appends another observation to the event record. A long-lived session
can therefore grow without bound while its event count remains within capacity.
Repeated observations are legitimate provenance, so simply deduplicating by
relay would destroy information.

Three other verified execution inconsistencies are independent but similarly
narrow:

- planning refines `subject.type in ["event"]` to an events collection while
  execution only refines `equals`, allowing incoherently typed outputs;
- a chained divide expression can turn divide-by-zero `null` into numeric zero;
- acquisition does not guard a synchronous WebSocket `send()` failure although
  the relay-count transport does.

The permanent crypto boundary also lacks a well-formed but incorrect signature
case.

## Goal

Keep memory genuinely bounded and make these established operations execute
according to their existing contracts without introducing new research
semantics.

## Work

1. Add an engine-owned maximum of 100 retained observations per canonical event.
   Publish it as a factual memory constraint through the existing global
   constraint/schema surface.
2. Deduplicate genuinely identical observations while they are retained.
   Observations from the same relay at different observed times remain distinct
   facts.
3. Once the per-event bound is reached, discard further observation objects and
   increment a count of discarded observation attempts. The count is not a
   count of distinct unseen facts: exact deduplication of an unbounded discarded
   stream would itself require unbounded memory. Do not retain a second cache,
   rolling identity set, or probabilistic structure for omitted observations.
   Surface the boundedness and omission semantics wherever event provenance or
   memory/corpus facts make them relevant.
4. Preserve the observation omission fact through buffer snapshots,
   transactions, canonical archive preservation, resolution, and presentation.
5. Use one authoritative collection-kind refinement rule for both validation/
   planning and execution. A single-value `in` predicate over `subject.type`
   must behave like its equivalent `equals` predicate.
6. Make division null-preserving across the whole chain. Division by zero or a
   prior null result must yield null, never recover into a number.
7. Guard the acquisition WebSocket `send()` call. A synchronous failure must
   settle that relay attempt with an attributed peer/transport outcome rather
   than escape the listener or become a timeout.
8. Add one protocol-level case using a structurally valid but cryptographically
   incorrect Schnorr signature.
9. Keep Node and browser consumers on the same execution paths.

## Acceptance criteria

- At most 100 observation objects are retained for one event regardless of how
  many times it is ingested.
- Repeated but distinct observations remain provenance until the bound is
  reached; identical retained observations do not consume additional slots.
- Omitted observation-attempt count is machine-readable, is not described as
  distinct omitted evidence, and survives transaction and archive paths.
- `subject.type equals "event"` and `subject.type in ["event"]` produce the same
  typed collection and compatible movement routes.
- Divide-by-zero remains null through subsequent divide operands.
- A synchronous acquisition `send()` failure is reported and cannot crash or
  hang the session.
- A canonical-looking event with the wrong valid-length signature is rejected.
- No trust, ranking, navigation, or vessel behavior is added.

## Non-goals

- Retaining an unbounded observation timeline.
- Exact deduplication or approximate membership tracking for discarded
  observations.
- Per-relay observation quotas, sampling policies, persistence, or byte-weighted
  memory accounting.
- Changing the distinct-event buffer capacity or acquisition budgets.
- A transport testing framework or new WebSocket abstraction.
- Unit tests for private collection, relation, or transport helpers.

## Verification

- Permanent tests expected: yes, by extending existing public memory/session,
  relation, acquisition, and protocol functional scenarios where practical.
- Stable public behavior protected: bounded provenance with visible omissions,
  typed collection refinement, derive null semantics, attributed send failure,
  and signature verification.
- Temporary task validation or field evidence: deterministic repeated ingestion
  and fake-WebSocket send failure; no DNS or public relay.
- Explicitly excluded test levels or mechanisms: one test file per fix, private
  helper imports, live relays, TCP servers, timing benchmarks, and exhaustive
  transport simulation.


# Latest independent review

CHANGES_REQUIRED

1. Omission facts are lost or misreported in collection presentation. `memory.select()` and account resolution in `#resolveCollectionItem()` omit `omittedObservationCount`, while `showCollection()` coverage summarizes the original unresolved items. Consequently, preview/coverage output can report zero omitted observations despite recorded discarded attempts. Preserve the count through these result paths and expose it explicitly as discarded observation attempts—not distinct omitted evidence.