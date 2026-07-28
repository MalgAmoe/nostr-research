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
id: 067-explicit-nip11-relay-inspection
status: in_progress
max_attempts: 4
validation: workflow/tasks/067-explicit-nip11-relay-inspection.validate.sh
depends_on: 066-relay-message-and-outcome-visibility
---

# Add explicit attributed NIP-11 relay inspection

## Confirmed code seam

The operation registry, normalizer/executor, plans, declarative session,
handles, presentation, schema, JSONL adapter, and browser Worker already form
one public execution path. NIP-11 must enter through that path as an explicit
external operation.

Existing non-relation handles are assumed to contain subject collections in
parts of contextual schema and presentation. A relay-information report is not
a Nostr subject collection, acquisition report, notebook entry, or archive
record. Supporting it therefore requires one factual result kind and explicit
presentation/schema handling; it must not be coerced through
`memory.asCollection`.

The runtime-neutral core has standard `fetch` available in Node and browser
environments. Node streams, filesystem access, and process configuration
remain adapter concerns.

## Goal

Allow a caller to explicitly inspect what selected relays advertise through
NIP-11 and how each retrieval actually behaved, without mutating research
memory or turning advertisements into observed capability or trust.

## Required work

1. Add one input-free external research operation named `relay-info`.
2. Accept explicit relay URLs, or configured session relay defaults, plus
   bounded timeout and concurrency parameters. Reuse the shared relay URL
   normalization rule and the established configuration precedence.
3. Convert each normalized `wss://` relay URL to the corresponding HTTPS
   NIP-11 endpoint without changing its host or path.
4. Request the document with `Accept: application/nostr+json` through the
   runtime's standard fetch interface. Do not create a Node-only HTTP path or
   serialize runtime capabilities into command parameters.
5. Bound:
   - number of concurrent requests;
   - operation duration;
   - retained response bytes;
   - retained strings, arrays, unknown fields, and presentation output.
   A hostile or malformed relay response must not consume unbounded memory.
6. Return one attributed `relay-information-report` containing the exact
   requested relays, retrieval time/bounds, and one outcome per relay.
7. Distinguish successful document retrieval from connection failure, timeout,
   non-success HTTP status, incompatible content, invalid JSON, oversized
   response, and malformed known fields. Preserve useful bounded HTTP status,
   content type, diagnostic, and omission information.
8. Retain the bounded advertised document as attributed relay evidence and
   expose normalized convenience fields only where they are unambiguous,
   including supported NIPs and advertised limitations. Missing optional
   fields mean absent claims, not retrieval failure.
9. Keep `advertisedAuthRequired` as a NIP-11 claim. It must not become an
   acquisition outcome or evidence that another request was refused.
10. Register the operation once in the authoritative operation semantics,
    normalization, preflight, execution, schema, plans, and session path. The
    operation mutates no observation-buffer, archive, or notebook state.
11. Make the ephemeral report nameable as a session handle with a factual
    `relay-information` descriptor and count equal to requested relay outcomes.
    Handle release must behave like other working views.
12. Extend bounded presentation for this result only:
    - `show summary` gives compact outcome/capability counts;
    - `show preview` gives bounded per-relay advertised highlights;
    - `show coverage` gives retrieval outcomes, bounds, and omissions; and
    - `show details` gives bounded retained documents and diagnostics.
    `show explain` and direct `inspect` must not be repurposed for relay
    information.
13. Extend contextual schema to describe relay-information structure and its
    observation modes without pretending it supports subject-collection or
    relation operations. Do not advertise invented next actions.
14. Keep the report separate from acquisition coverage. Ordinary acquisition
    must not issue a hidden NIP-11 request.
15. Keep the report out of the research notebook and evidence archive. A later
    caller may interpret or compare it explicitly, but M5 adds no relay
    subject, trust score, quality ranking, or persistence.
16. Update package documentation, `NEXT-STEPS.md`, the capability map, and
    `CONTEXT.md` only to record the implemented explicit operation and durable
    distinctions.

## Acceptance criteria

- Direct execution, plans, declarative sessions, JSONL, and the browser Worker
  reach one `relay-info` implementation.
- The operation uses session relay defaults when explicit relays are absent
  and per-command values override those defaults.
- A named relay-information handle can be listed, shown in its four supported
  bounded modes, queried through contextual schema, and released.
- Contextual schema never attempts to coerce the report into a subject
  collection and advertises no collection, relation, notebook, archive, or
  subject-inspection operation.
- HTTP and document failures remain attributed per-relay outcomes and cannot
  masquerade as an empty advertisement.
- Advertised capability remains distinct from observed acquisition behavior.
- No hidden NIP-11 request occurs during acquisition.
- No Node-only dependency, alternate executor, relay identity subject,
  persistence, scoring, retry policy, NIP-42 response, or NIP-45 count is
  introduced.

## Verification

- Permanent tests expected: yes, through one existing public-boundary
  operation/session scenario using a temporarily installed deterministic
  standard global `fetch` fixture. Do not add a production injection seam
  solely to satisfy the test.
- Stable public behavior protected: operation normalization, plans and
  sessions sharing one executor, configured defaults, per-relay outcome
  attribution, bounded response handling, handle lifecycle, presentation, and
  schema.
- Include representative success, HTTP failure, malformed JSON, oversized
  response, missing optional fields, and `advertisedAuthRequired` behavior
  without importing private parsing helpers.
- Temporary task validation: syntax checks, the complete functional suite,
  and the existing runtime-neutral/browser smoke validation.
- Explicitly excluded: live public-relay checks, HTTP server tests, TCP/TLS,
  browser UI, exact fetch scheduling, snapshotting entire NIP-11 documents,
  and tests that freeze private parser structure.


# Worker report

Implemented explicit bounded NIP-11 relay inspection.

Deliverables changed:

- Added the shared `relay-info` operation and runtime-neutral fetch implementation.
- Added attributed per-relay outcomes, bounded document retention, normalized advertised NIPs/limitations, and `advertisedAuthRequired`.
- Integrated direct execution, plans, sessions, handles, JSONL/browser execution path, schema, and four presentation modes.
- Kept reports separate from acquisition coverage, memory, archive, and notebook state.
- Updated README, `NEXT-STEPS.md`, capability map, `CONTEXT.md`, and package checks.

Validation:

- Syntax checks passed.
- Complete functional suite passed: 25/25.
- Targeted relay-information scenario passed.
- `git diff --check` passed.
- Browser smoke reached Chromium launch but was blocked by the managed macOS sandbox (`MachPortRendezvousServer: Permission denied`), not a product assertion failure.

Permanent tests added:

- One public-boundary functional scenario protecting normalization, direct/plan/session executor sharing, configured defaults, attributed failure outcomes, bounded retention, handle listing/show/schema/release, missing optional fields, and advertised authentication behavior. Temporary validation was insufficient because these are stable cross-layer public contracts.

Unresolved uncertainties:

- Browser smoke requires rerunning in an environment permitted to launch Playwright Chromium.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/protocol.js && node --check src/reference.js && node --check src/protocol-relationships.js && node --check src/relay-url.js && node --check src/configuration.js && node --check src/contract-facts.js && node --check src/memory.js && node --check src/collection.js && node --check src/acquire.js && node --check src/relay-info.js && node --check src/operations.js && node --check src/relation.js && node --check src/pipeline-source.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check src/browser-worker.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

✔ acquisition rejects unusable public inputs before networking (1.704125ms)
✔ public acquisition and session reports preserve bounded relay messages and honest outcomes (14.380708ms)
✔ address subjects navigate typed references to current local replaceable evidence (100.900875ms)
✔ ordinary acquisition accepts an explicit canonical #a filter (0.749334ms)
✔ direct, plan, and session execution share operation kinds and failure boundaries (46.365583ms)
✔ collections navigate identities while relations own value analysis (12.402792ms)
✔ named account and note handles continue with bounded relationship provenance (2294.32675ms)
✔ factual schemas construct commands accepted through the public session seam (47.89675ms)
✔ declarative observation and lifecycle form one bounded public workflow (37.251791ms)
✔ relation summaries compact source selection details without losing their shape (5.365042ms)
✔ declarative named results compose compatible sets and expose their schema (15.873917ms)
✔ declarative notebook knowledge survives turnover and remains independent from evidence (19.6155ms)
✔ explicit archive preservation survives complete buffer turnover and releases atomically (59.702292ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (40.586708ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (31.246458ms)
✔ JSONL executable provides one persistent bounded process workflow (97.464459ms)
✔ process-local memory preserves canonical evidence and independent relay observations (34.519625ms)
✔ public references normalize to stable subjects while hints stay attributed metadata (3.096084ms)
✔ mixed event kinds derive truthful references without polluting conversations (53.588916ms)
✔ inline NIP-27 references navigate as typed, explainable evidence without becoming threads (10.246875ms)
✔ replaceable selection and follow interpretation remain stable in one process (24.536375ms)
✔ public local search composes constraints, explains matches, and preserves provenance (28.206125ms)
✔ relation handles resolve references across evidence lifetime and keep bounded views composable (56.345625ms)
✔ relay information stays attributed, bounded, and reusable through the public executor (14.301958ms)
✔ large notebook membership is atomic, bounded, process-local, and directly navigable (2258.995417ms)
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2558.232792
browser smoke passed: Worker, memory, acquisition, handles, preview, close


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.