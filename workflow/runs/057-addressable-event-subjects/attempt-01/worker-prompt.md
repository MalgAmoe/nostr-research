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
id: 057-addressable-event-subjects
status: in_progress
max_attempts: 4
validation: workflow/tasks/057-addressable-event-subjects.validate.sh
depends_on:
---

# Add addressable-event subjects and local navigation

## Goal

Make NIP-01 `a` coordinates stable, truthful research subjects instead of
leaving them as generic tag strings. An address identifies replaceable or
addressable event state; it must never masquerade as an immutable event ID.

## Required work

1. Add one canonical `address` subject form for
   `<kind>:<32-byte-lowercase-pubkey>:<d>`.
   - Normal replaceable kinds `0`, `3`, and `10000`–`19999` require the
     trailing colon and an empty `d`.
   - Addressable kinds `30000`–`39999` retain the complete `d` value,
     including any colons after the first two separators.
   - Other kinds and malformed coordinates are rejected as address subjects.
2. Integrate address subjects with the existing stable-subject machinery:
   collections, lookup, inspection, evidence resolution, notebook membership,
   preservation references, presentation, and relation subject extraction.
   Do not create a parallel address API.
3. Resolve an address locally to the current resident or archived replaceable
   event using the existing timestamp and lowest-ID tie-breaking rules.
   Historical event IDs remain independently inspectable evidence.
4. Derive typed address relationships from canonical tags:
   - ordinary valid lowercase `a` tags become `referenced-address`;
   - valid NIP-22 kind-1111 `A` and `a` tags retain distinct root and parent
     address semantics rather than entering the immutable-event conversation
     graph.
   Invalid address-looking tags remain raw canonical tags and must not create
   a typed address subject.
5. Add the smallest collection navigation routes needed to move from events to
   referenced addresses and from addresses to their current locally resolved
   events. Preserve relationship reasons, canonical tag evidence, provenance,
   and honest unresolved results.
6. Make the new subject and routes visible through the existing factual and
   contextual schemas. Keep plans, direct execution, and sessions on the same
   normalized executor.
7. Confirm that an explicit ordinary acquisition filter using `#a` still
   accepts a canonical coordinate. Do not add automatic acquisition or a
   task-specific networking command.
8. Update durable project and package documentation only where the public
   subject and navigation model changed.

## Acceptance criteria

- Address equality depends only on the canonical coordinate, never on a relay
  hint or a currently resolved event ID.
- Resolving an address chooses the same current event as the existing
  replaceable-event rules.
- Buffer/archive turnover changes evidence resolution honestly without
  changing address identity.
- Event-to-address-to-current-event navigation is available through the
  established collection operations and explains every transition.
- NIP-22 address roots and parents do not silently become NIP-10 event edges.
- Existing event, account, and tag behavior remains compatible.
- No hidden relay contact, persistence, universal event-kind registry, or
  second operation language is introduced.

## Verification

- Permanent tests expected: yes.
- Stable public behavior protected: address validation and identity; current
  replaceable resolution; typed `a`/`A` relationships; public collection,
  inspection, schema, and explicit `#a` behavior.
- Prefer extending one existing public-boundary protocol/navigation scenario
  over helper-level tests.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: live relay tests, TCP/TLS/WebSocket mechanics, UI,
  NIP-19 decoding, and automatic use of relay hints.
