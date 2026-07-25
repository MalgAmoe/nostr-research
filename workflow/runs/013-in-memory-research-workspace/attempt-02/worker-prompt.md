# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.
Do not stage or commit changes; the runner owns the task commit after review.

If a previous review is supplied, address every applicable finding explicitly.
Do not merely describe work that should be done: perform the task within its
stated permissions.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
- unresolved uncertainties.


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

- SQLite is the one real storage path for the library, CLI, functional
  verification, and future applications. Do not introduce an in-memory store
  as a production or functional-test substitute.
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
- Experimental databases are disposable and regenerable. During this phase
  there is no compatibility or migration burden for database formats.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The local SQLite-backed research record of evidence, observations, and replaceable derived material. |
| **workspace** | A bounded, disposable in-process corpus of stored evidence with private indexes for repeated selection and relationship traversal; it is attached to memory and is not a persistence implementation. |
| **session** | A temporary, in-process research playground coordinating selection, focus, provisional exclusions, branches, and meaningful actions over memory. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **focus** | An optional subject receiving attention in a session; it is independent of and does not rewrite the selection. |
| **temporary branch** | A session-local named snapshot of selection, focus, and exclusions used to revisit an exploratory path; it is not durable evidence. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | A durable record of one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One durable recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it; unlike a session, it is an immutable operation snapshot. |
| **research set** | A deliberately saved, named or otherwise identifiable group of evidence for later inspection or expansion. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with real SQLite.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, permanent
database schema, ranking method, or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- the durable provenance detail and research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Playground boundaries

A workspace is a bounded temporary corpus rebuilt from caller-selected durable
evidence. It accelerates repeated local selection and traversal but does not
replace memory or make evicted evidence less durable. A session coordinates
selection, focus, exclusions, history, and temporary branches over memory
operations or their workspace equivalents. A result collection is the shared
operation result passed between these layers. A research set is the explicit
durable checkpoint of chosen subjects and reasons; a research run is a durable
account of an operation. Neither a workspace, a session, nor session branches
are serialized as a whole.

Local selection asks what the current SQLite memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
records bounded acquisition coverage. Coverage says that a precise
relay/filter/budget attempt occurred. It never says that the relay or time
window was exhaustively indexed.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.


# Selected task

---
id: 013-in-memory-research-workspace
status: in_progress
max_attempts: 5
validation: workflow/tasks/013-in-memory-research-workspace.validate.sh
depends_on: 012-research-sessions-and-coverage
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add a bounded in-memory research workspace

## Objective

Make an in-process corpus the active environment for iterative research while
retaining SQLite as the current durable evidence store.

This is not a second permanent data model and not a generic storage backend.
It is a bounded, disposable working set that can be rebuilt from memory,
incrementally updated, and searched or navigated repeatedly without returning
to SQLite for every step.

## Runtime model

Expose one cohesive public workspace entry point. It must:

- attach to an open `ResearchMemory`;
- explicitly load a caller-selected, bounded slice of stored canonical events;
- incrementally accept newly acquired or explicitly selected stored evidence;
- deduplicate canonical events by event ID;
- preserve relay observations and relationship interpretation;
- maintain useful indexes for event ID, author, kind, tags, and inbound/outbound
  relationships;
- expose counts and bounds without dumping the corpus; and
- enforce a caller-visible event capacity with deterministic eviction.

The workspace is temporary. Closing it must not delete durable evidence.
Opening a new workspace over the same SQLite memory must reproduce the selected
working corpus.

## Operations

Provide a small composable surface that covers the actual research loop:

- load or add evidence;
- select events using the existing meaningful query constraints;
- turn results into the shared result-collection vocabulary;
- traverse stored relationships in either direction with explicit depth and
  limits;
- inspect a subject with canonical evidence and provenance; and
- retain a chosen collection through the attached durable memory.

Reuse existing query validation, subject vocabulary, relationship semantics,
and projections where they remain appropriate. Do not create subtly different
meanings for the same public terms.

The workspace may call SQLite for explicit persistence, corpus loading, or
evidence detail that was not loaded. Ordinary repeated selection and traversal
over the loaded corpus must operate on the in-memory structures.

## Boundaries

- SQLite remains the only persistence implementation.
- Do not introduce a generic database adapter, ORM, HTTP API, worker protocol,
  UI, ranking system, or discovery heuristic.
- Do not attempt to hold an unbounded relay or the whole Nostr network.
- Do not duplicate the complete `ResearchMemory` method surface.
- Do not expose internal maps as mutable public state.
- Keep implementation cohesive; do not split every index into its own class.

## Documentation

Document the distinction between durable research memory, the temporary
in-memory workspace, reusable result collections, and sessions. Update
`CONTEXT.md` only with vocabulary that is settled by the implementation.

## Verification

Add one public functional scenario that:

- stores a corpus large enough to exercise the capacity;
- loads a bounded workspace and verifies deterministic contents;
- performs repeated text/author/tag selection and bidirectional traversal;
- incrementally introduces new stored evidence and deduplicates it;
- retains a workspace result;
- closes and recreates the workspace from SQLite; and
- proves evicted workspace events remain durable.

Do not add tests for private maps or individual index helpers.

## Acceptance criteria

- In-memory corpus size is explicitly bounded.
- Selection and traversal over loaded evidence do not query SQLite per step.
- Results remain compatible with sessions, projection, and retention.
- Relay observations and relationship explanations remain available.
- Workspace eviction never deletes SQLite evidence.
- Existing library and CLI behavior remain usable.
- Permanent verification stays at the public functional boundary.


# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/index.js:1569` trusts an embedded `item.record` instead of hydrating the subject from attached SQLite memory. Public result-collection validation checks only the subject, so `workspace.add()` can admit fabricated or non-stored evidence and can restore stale observations from an older collection. Change incremental hydration to resolve canonical evidence and current observations from `ResearchMemory`, and extend the public functional scenario to verify collection-based refresh after a new relay observation.