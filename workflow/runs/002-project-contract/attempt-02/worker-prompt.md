# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.

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
id: 002-project-contract
status: in_progress
max_attempts: 4
validation: workflow/tasks/002-project-contract.validate.sh
depends_on: 001-inventory
protected_paths: src server.mjs index.html vite.config.js package.json package-lock.json
---

# Establish the canonical project contract

## Objective

Create concise durable context for every future worker and reviewer before the
repository is reorganized or the research library is built.

The document must state settled principles clearly while preserving uncertainty
where experimentation is still required. It must not prescribe a final public
API, permanent database schema, or complete future architecture.

## Sources

- `workflow/artifacts/capability-inventory.md`
- `workflow/artifacts/current-dependency-map.md`
- `workflow/artifacts/open-questions.md`
- `workflow/ROADMAP.md`
- the selected task and workflow rules

## Required deliverables

### `CONTEXT.md`

Define:

- the project's purpose as a tool for research, navigation, and exploration of
  Nostr rather than a conventional feed client;
- the UI-independent library as the product foundation and user interfaces as
  consumers;
- the current Solid application as a behavioral reference whose code and
  behavior may be retained, recreated, or rejected deliberately;
- SQLite as the one real storage path for the library, CLI, functional
  verification, and future applications;
- raw valid Nostr events as immutable source evidence;
- derived indexes and interpretations as reproducible and replaceable;
- relay acquisition and local-memory querying as distinct, composable
  operations;
- provenance and reasons for result inclusion as observable research output;
- disposable/regenerable databases and no compatibility or migration burden
  during the experimental phase;
- the boundary between settled principles and open product decisions;
- concise shared terminology for event, observation, memory, acquisition,
  query, research run, research set, provenance, and derived relationship.

Include the testing policy:

- permanent unit tests are reserved for difficult stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing;
- functional tests exercise public library or CLI boundaries using real SQLite;
- there is no automatic requirement to add a test for each feature or bug;
- tests must not import private helpers or freeze internal architecture;
- task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests;
- live relay checks are task validation when network behavior is under review,
  not an always-on brittle test suite.

### `docs/decisions/001-library-and-memory.md`

Record why the project is beginning with a UI-independent library and SQLite
research memory, the consequences of that decision, and what remains
deliberately undecided. Do not create multiple decision records for the same
choice.

### Workflow consistency

Update `workflow/WORKFLOW.md` only if the new canonical context exposes a direct
contradiction. Do not duplicate the complete context into workflow
documentation.

## Acceptance criteria

- A fresh worker can understand the project direction without conversation
  history.
- Settled decisions and unresolved design questions are visibly distinct.
- The testing policy matches the selected task exactly and discourages
  implementation-coupled test growth.
- SQLite is the real path used by production and functional verification; no
  in-memory substitute is proposed.
- The documents do not prematurely define a final API, schema, ranking method,
  or UI.
- Material statements are consistent with the reviewed inventory.
- No product source or package file is modified.


# Latest independent review

CHANGES_REQUIRED

1. `workflow/tasks/002-project-contract.validate.sh` exits 1 because its open-decision grep pattern is double-escaped and cannot match `CONTEXT.md`. Correct the pattern to `unresolved\|undecided\|open decision` and rerun validation. The intended pattern matches the document; the current script requires literal backslashes.