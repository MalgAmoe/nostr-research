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
does not define the domain boundary. The current Solid application is a
behavioral reference during this work. Its code and observed behavior may be
retained, recreated, or rejected deliberately; neither its Solid controllers,
browser persistence, nor its present module layout is an implicit target
architecture.

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

The current application contains useful behavior in all of these areas, but it
does not settle them. In particular, its IndexedDB/localStorage persistence,
Solid state, hidden array metadata, relay cache policy, and editorial scoring
heuristics must not be copied into the library by default.


# Selected task

---
id: 007-saved-research
status: in_progress
max_attempts: 5
validation: workflow/tasks/007-saved-research.validate.sh
depends_on: 006-query-and-navigate-memory
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Preserve and continue research paths

## Objective

Let callers preserve how evidence was selected, reopen it later, and continue
research without relying on UI session state or conversation memory.

Build this on the existing acquisition, local-query, navigation, and SQLite
boundaries. Keep the model small enough to evolve.

## Research runs

Persist an immutable record for a completed acquisition or local-query
operation containing:

- a stable run identifier;
- operation type and normalized public inputs;
- start and finish times;
- completion status and diagnostics;
- result event and account identifiers;
- enough provenance and match-reason information to explain the recorded
  result without reproducing hidden UI state.

A run records what happened. Re-running the same inputs creates another run
rather than rewriting history.

Do not store sockets, callbacks, transient implementation state, or SQL details.

## Research sets

Support durable named sets that can contain event and account identifiers:

- create, list, inspect, rename, and delete a set;
- add and remove members explicitly;
- retain one or more membership reasons and the source run or source entity
  when applicable;
- create a set from a recorded run;
- reopen the database and continue using the same set;
- tolerate referenced evidence that is not yet present locally.

Names are user-facing labels, not identity. Set identifiers must remain stable
when renamed.

## Continuation and set operations

Through the public library boundary:

- expand a set using selected observable relationship types already supported
  by local navigation;
- preserve the source member and relationship evidence for expanded members;
- combine sets using union, intersection, and difference without mutating the
  input sets;
- distinguish event and account members;
- explain why every member is in a resulting or expanded set.

No operation should silently contact a relay. A future caller can explicitly
run acquisition and then record or add its results.

## CLI behavior

Add discoverable structured commands that can:

- record or save the result of an acquisition or local query as a run;
- list and inspect runs;
- create and manage named sets;
- create a set from a run;
- expand a set;
- combine sets;
- explain one set member.

The exact command grouping may remain compact, but it must be practical for a
human or Codex CLI workflow and must not require direct SQLite access.

## Scope boundaries

- Do not add UI state, tabs, layouts, browsing history, ranking, suggestions,
  moderation policy, synchronization, accounts-to-follow semantics, or remote
  storage.
- Do not preserve compatibility with disposable databases created before this
  task.
- Do not introduce a general workflow engine or abstract graph framework.
- Do not force all future research methodology into one fixed schema.

## Verification

Use the public library and CLI with a temporary real SQLite database to perform
one complete black-box path:

1. ingest or acquire signed evidence;
2. perform a local query and record its run;
3. create a set from that run;
4. expand it through an observable relationship;
5. combine it with another set;
6. close and reopen the database;
7. inspect the saved set and explain membership.

The functional scenario should verify behavior, not internal tables. Add no
per-helper or per-command tests.

The independent reviewer must create its own set names and operation sequence,
including at least one unresolved entity, removal, rename, and set difference.

## Acceptance criteria

- Runs preserve public operation inputs, outcomes, result identifiers, reasons,
  and diagnostics without UI state.
- Saved sets survive database close and reopen.
- Every derived membership is explainable from explicit selection, a run,
  another set, or stored relationship evidence.
- Expansion and set operations are deterministic and bounded.
- Input sets are not mutated by union, intersection, or difference.
- Missing local evidence remains representable.
- CLI output is structured and failures are useful and non-zero.
- The schema and API remain focused on research paths rather than generalized
  application state.
- Reference-client behavior and source remain unchanged.
