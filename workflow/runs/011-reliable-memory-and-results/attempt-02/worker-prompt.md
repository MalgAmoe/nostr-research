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

The product foundation is a UI-independent library. A CLI, functional
verification, and future user interfaces are consumers of that library; a UI
does not define the domain boundary. The first Solid application was an
experiment and has been removed. Its retained lessons may inform future work,
but its controllers, browser persistence, scoring rules, and module layout are
not a target architecture.

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
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it. |
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
- which future UI workflows, if any, should consume the library.

The removed experiment contained candidate behavior in these areas but did not
settle them. Its retained lessons are documented in
`docs/solid-experiment-lessons.md`; its IndexedDB/localStorage persistence,
Solid state, relay cache policy, and editorial scoring heuristics must not be
recreated by default.


# Selected task

---
id: 011-reliable-memory-and-results
status: in_progress
max_attempts: 5
validation: workflow/tasks/011-reliable-memory-and-results.validate.sh
depends_on: 010-composable-research-kernel
protected_paths: docs/solid-experiment-lessons.md workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make research memory reliable at realistic corpus size

## Objective

Repair the concrete reliability and performance failures found during live
research before adding new research concepts.

The behavior of selection, traversal, projection, runs, and research sets
should remain recognizable. This task deepens their implementations so a
researcher can safely operate on hundreds or thousands of events.

## Atomic bulk retention

All operations that create a populated research set must be atomic:

- retaining a result collection;
- creating a set from a run;
- expanding a set; and
- combining sets.

If validation, interruption, or insertion fails, the new set and all of its
members and reasons must be absent. A caller must never observe a partially
created set.

Use one transaction for the complete bulk write. Do not call the public
single-member operation in a loop. Prepare statements once where practical,
deduplicate members and reasons before writing, and return a bounded
acknowledgement without reloading every reason merely to count members.

The public single-member editing behavior may remain for interactive changes.

## Concentrated SQLite evidence access

Stop repeatedly loading the complete event corpus and issuing one observation
query per event.

Concentrate SQLite evidence access inside a small internal module or cohesive
section that supports the actual current operations:

- indexed event selection and prefix resolution;
- current account metadata lookup;
- event hydration with observations;
- relationship lookup or reproducible relationship scanning;
- subject summary hydration; and
- counts and bounded previews for sets and runs.

Add only indexes justified by those operations. SQLite remains the sole real
storage path. Do not introduce a generic backend interface, ORM, repository
framework, or migration compatibility layer.

## Shared result behavior

Reduce unnecessary parallel behavior without forcing a broad redesign:

- selection and traversal continue to return reusable result collections;
- acquisition, account results, and convenience navigation should be
  adaptable into the same collection vocabulary without parsing rendered
  output;
- seed subjects and newly discovered subjects must remain distinguishable;
- compact projection must not repeat complete source and target summaries on
  every relationship;
- full projection retains canonical evidence and complete explanations;
- retention acknowledgements remain bounded independently of corpus size.

Do not remove useful compatibility operations solely to make the method list
shorter. Delete pass-through shaping only where the shared operation fully
replaces it and callers/tests can move to the deeper interface.

## Provenance size

Preserve explainability while avoiding repeated embedding of identical
observation arrays inside every traversal reason and set reason.

Stable references to stored evidence, observations, runs, or acquisition
context are preferable when the explanation can be reconstructed. Do not
discard relay, time, filter, relationship interpretation, or membership
reasons.

## Documentation

Update the package documentation to describe:

- atomic retention behavior;
- result-collection seed versus discovery semantics;
- the cost and bounds of compact versus full projection; and
- SQLite as the current implementation rather than a permanent public data
  model.

## Scope boundaries

- Do not add research sessions, new application code, ranking, discovery
  heuristics, aggregations, or relay-planning policy.
- Do not recreate any removed Solid application code.
- Do not preserve old experimental database compatibility.
- Do not split files merely to reduce line counts.
- Do not add tests for private helpers or every projection variation.

## Verification

Permanent verification should contain:

- one functional scenario retaining at least 1,000 result members and multiple
  reasons within a reasonable local runtime;
- one deliberate failure scenario proving rollback leaves no partial set;
- one representative selection/traversal/projection flow over a corpus large
  enough to expose full-corpus/N+1 regressions; and
- existing protocol-focused and public functional scenarios.

The reviewer must use the public library with a disposable SQLite database,
retain a realistically large selection, close/reopen it, and verify complete
membership. It must also inspect compact thread output for bounded repetition.

## Acceptance criteria

- No populated-set operation can leave a partial new set.
- Retaining 1,000 ordinary event members completes without per-member
  full-set reloads.
- Common bounded selection and projection do not hydrate every observation for
  the entire corpus.
- Compact relationship and thread output are materially bounded.
- Full evidence and provenance remain explainable.
- Shared result collections remain directly composable.
- Existing public research behavior and CLI commands remain usable.
- Permanent tests stay boundary-focused.



# Latest independent review

CHANGES_REQUIRED

1. Compact set/run access is not bounded. `listSets()` reloads every member and reason through `getSet()` (`src/index.js:645`), while compact set projection also calls `getSet()` before counting and previewing (`src/index.js:950`). Similarly, `listRuns()` and compact run projection deserialize complete result/diagnostic payloads (`src/index.js:622`, `src/index.js:966`). Implement SQLite count and bounded-preview queries so compact projections and list commands do not load complete sets or runs.

2. The rollback test does not exercise rollback. The cyclic reason fails during prevalidation/serialization before `BEGIN` (`test/reliability.functional.test.js:42` versus `src/index.js:695`). Add a deliberate failure occurring after the bulk transaction begins and verify that the set row, members, and reasons are all absent afterward.