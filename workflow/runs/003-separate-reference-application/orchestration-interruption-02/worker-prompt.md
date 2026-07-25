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
id: 003-separate-reference-application
status: in_progress
max_attempts: 4
validation: workflow/tasks/003-separate-reference-application.validate.sh
depends_on: 002-project-contract
protected_paths: CONTEXT.md workflow/artifacts workflow/runs workflow/run.py workflow/prompts
---

# Separate the reference application

## Objective

Give the repository a simple physical boundary between the existing Solid
application and the new UI-independent library without changing application
behavior.

## Required result

Create this minimal shape:

```text
apps/
  reference-client/
packages/
  nostr-research/
workflow/
docs/
```

Move the existing application source, server, HTML, Vite configuration,
key-generation script, package metadata, runtime `keys/` and `logs/` locations
as appropriate into `apps/reference-client/`. Generated output, installed
dependencies, secrets, keys, and usage logs must not be committed or copied as
source assets.

Create a minimal root npm workspace that can run the reference client commands.
Reserve `packages/nostr-research/` without inventing its implementation in this
task. A short README or placeholder package description may establish its
purpose.

## Constraints

- Preserve reference-client runtime behavior and its existing commands.
- Do not refactor product modules while moving them.
- Do not make the reference client consume the future library.
- Do not introduce shared configuration packages, build orchestration
  frameworks, monorepo managers, or compatibility wrappers.
- Update repository paths in documentation, ignores, and scripts only where the
  move makes that necessary.
- Existing uncommitted source content belongs to the project and must be moved
  intact.

## Acceptance criteria

- The root clearly separates applications from packages.
- The reference client installs through the root workspace and can be started
  from an obvious root command.
- Its existing tests and production build pass from the reorganized repository.
- Its server and key-generation scripts pass syntax checks.
- No existing product source module or permanent test is deleted.
- Git ignores generated databases, dependencies, builds, keys, and logs at
  their new locations.
- `packages/nostr-research/` contains no speculative architecture.
- The resulting organization is understandable without wrapper scripts.


# Latest independent review

PASS

All acceptance criteria are materially satisfied. The client files are preserved under `apps/reference-client/`, root workspace commands target it directly, generated runtime assets are ignored, and the library directory contains only a purpose README. Tests, production build, and both syntax checks completed successfully; the recorded nonzero validation status is from the workflow’s protected `workflow/runs` fingerprint, not a product validation failure.