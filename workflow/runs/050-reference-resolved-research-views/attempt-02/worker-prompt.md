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
| **result handle** | A session-owned name for an engine view. Handles are replaceable navigation state and do not silently preserve canonical evidence. |
| **subject collection** | A bounded set of stable Nostr subjects with membership reasons and provenance. |
| **research relation** | A bounded composable view of stable subjects, derived values, reasons, and provenance. Source-backed fields resolve from the archive or buffer; a relation must not accidentally become an undocumented evidence archive. |
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

Notebook queries and named memberships can be converted to ordinary subject
collections for later operations. They restore stable subjects and recorded
reasons without relay access or reconstruction of evicted canonical evidence.
Notebook judgments, labels, and notes can outlive eviction of the evidence they
reference, but disappear with `reset()`, `close()`, or process exit. Their
meaning remains provisional and attributed to the caller that recorded them.


# Selected task

---
id: 050-reference-resolved-research-views
status: in_progress
max_attempts: 5
validation: workflow/tasks/050-reference-resolved-research-views.validate.sh
depends_on: 049-research-notebook
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make collections and relations honest reference-resolved views

## Objective

Remove the accidental evidence archive inside research relations and handles
while preserving the composable operations that made the strict field trial
successful.

Views must remain useful for iterative research, but source evidence lifetime
must be controlled by the buffer and archive rather than undocumented row
copies.

## Work

- Inventory every value currently copied into subject collections, relations,
  acquisition/continuation reports, and session handles.
- Make stable subject references, operation context, ordering, bounded derived
  values, membership reasons, and provenance references the owned content of a
  view.
- Resolve source-backed event/profile fields through the authoritative
  archive/buffer resolver when an operation or projection needs them.
- Report source as `archive`, `buffer`, or `unresolved`; never preserve a stale
  `evidence.resident` value.
- Keep deliberate derived material bounded and visibly derived. In particular:
  - vocabulary scanning retains match field, term, source subject, and a
    bounded excerpt or match coordinates rather than an unlimited source
    field;
  - aggregation samples and collected values expose their truncation;
  - joins do not duplicate complete event/profile records.
- Define honest behavior when a later operation needs unavailable source
  fields: explicit omissions or a semantic unresolved-evidence error, not
  `INTERNAL_ERROR` and not silently stale data.
- Make `show` windows predictable. The returned effective offset/limit,
  size-bound truncation, omitted-before, and omitted-after must agree so the
  next window can be requested mechanically.
- Preserve the useful algebra (`filter`, `project`, `distinct`, `sort`,
  `limit`, `join`, `aggregate`, `derive`, `slice`, `explode`, `scan`,
  `balance`) unless live evidence shows a specific operation no longer earns
  its interface.
- Remove copied-evidence branches and tests rather than maintaining parallel
  relation formats.

## Acceptance criteria

- Ordinary relation and handle creation does not silently copy complete notes,
  profiles, tags, or observation records.
- Operations over resident or archived evidence retain their current practical
  composability.
- The same view clearly changes from buffer-backed to archive-backed or
  unresolved as evidence lifetime changes.
- Scan and aggregate outputs keep enough bounded evidence for judgment without
  becoming an unlimited source snapshot.
- Large and paginated `show` requests return bounded semantic results with
  reliable continuation metadata and no size-related `INTERNAL_ERROR`.
- Serialized view size is governed by selected subjects and bounded derived
  values, not accidental duplication of complete source events.

## Verification

- Permanent tests expected: yes, one public collection/relation functional
  scenario covering resolution changes, bounded scan evidence, joins, and
  deterministic window continuation.
- Stable public behavior protected: the composable relation algebra and
  bounded observation interface.
- Temporary task validation or field evidence: compare serialized sizes and
  behavior of an equivalent view before and after complete buffer turnover.
- Explicitly excluded test levels or mechanisms: snapshots of internal row
  shape, tests per algebra operation, private resolver tests, live relays,
  socket transport, UI, and compatibility tests for copied relation fields.


# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/relation.js` still permits aggregation to create an accidental evidence archive. `applyAggregate()` copies every `by` value directly into the output without retaining its source reference or bounding it. The `min` and `max` aggregations likewise return source-backed strings, arrays, or objects without `boundDerived()`. Grouping by `event.text`/`event.tags`, or taking their minimum/maximum, therefore stores complete source evidence in the relation and remains stale after eviction. Make all aggregate-owned source values bounded and visibly derived, or preserve resolvable references where semantics require the original value. Expand the public functional scenario to cover this aggregation path and its behavior after turnover.