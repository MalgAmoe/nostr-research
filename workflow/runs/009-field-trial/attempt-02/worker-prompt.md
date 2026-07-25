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
id: 009-field-trial
status: in_progress
max_attempts: 4
validation: workflow/tasks/009-field-trial.validate.sh
depends_on: 008-agent-friendly-cli-output
protected_paths: apps packages CONTEXT.md docs package.json package-lock.json README.md workflow/ROADMAP.md workflow/WORKFLOW.md workflow/run.py workflow/prompts workflow/tasks
reviewer_sandbox: workspace-write
---

# Conduct a real Nostr research field trial

## Objective

Use the library and improved CLI as an actual research instrument before
planning more product architecture. Record what works, what obstructs research,
what the data itself reveals, and which next tasks are justified by evidence.

This is an evaluation task. Product and workflow code are read-only.

## Required research paths

Use a disposable or retained Git-ignored SQLite database under `.data/`.
Contact two to four explicitly named public relays with bounded acquisitions
when the worker environment permits network access. A retained database may be
used as real evidence when its recorded acquisition run contains the exact
relays, filters, bounds, outcomes, identifiers, and per-event provenance needed
to verify how it was acquired. Do not claim relay coverage beyond the observed
sample.

The retained `.data/first-research.sqlite` is available as a starting candidate.
It was created through the public CLI before this task and should be accepted
only after independently verifying its recorded acquisition run and evidence.
If it is absent, empty, or unverifiable, perform a new bounded acquisition or
return `BLOCKED`; never substitute fixtures.

Complete at least two connected research paths:

1. Start from a topic or text question, acquire evidence, query it locally,
   inspect selected notes, pivot through at least two relationship types, save
   a run and set, expand or combine a set, close the database, reopen it, and
   continue.
2. Start from an account or account clue found in the first path, acquire or
   inspect relevant metadata/evidence, examine authored and referenced
   relationships, and preserve a second selection path.

Use compact output for navigation and request full output only when inspecting
specific evidence. Exercise IDs or NDJSON output in at least one composed step.

The goal is not to reach a broad factual conclusion about Nostr from a tiny
sample. The goal is to evaluate whether this tool supports directed,
explainable exploration.

## Required deliverable

Create `workflow/artifacts/first-library-field-trial.md` containing:

- the research questions and why they were selected;
- exact relays, filters, time bounds, limits, and significant commands;
- acquisition outcomes and database counts;
- a concise narrative of both research paths;
- representative event/account/run/set identifiers so observations are
  traceable in the retained database when available;
- what compact, IDs, NDJSON, and full output each enabled;
- whether provenance and match/membership reasons were understandable;
- whether search, relationship navigation, saved sets, and continuation
  produced useful next choices;
- observed relay or data-quality limitations separated from software defects;
- usability friction, missing capabilities, misleading concepts, and
  unnecessary capabilities;
- any command failure or awkward manual transformation encountered;
- a prioritized list of no more than five candidate next tasks, each tied to
  field-trial evidence;
- explicit recommendations for what not to build yet.

Do not paste large raw event or CLI dumps into the report. Summarize and cite
identifiers.

## Review expectations

The independent reviewer must:

- inspect the report against the retained database and command capabilities
  where available;
- reproduce at least one compact local query and one saved-set inspection;
- distinguish opinions supported by the trial from speculation;
- reject next-task recommendations that are not connected to observed
  friction or research value;
- avoid requesting product changes as optional polish.

Live relay variability is expected. If one relay fails, record it and continue
with successful relays. Use `BLOCKED` only if neither a bounded real acquisition
nor a traceable retained real-evidence database is available.

## Acceptance criteria

- Both research paths use real relay evidence and the complete
  acquisition-to-continuation flow.
- The report is traceable without becoming a raw data dump.
- Product and workflow code remain unchanged.
- The evaluation distinguishes software behavior, protocol/data limitations,
  and research-methodology questions.
- Recommendations follow from observed use rather than the old UI inventory.
- At most five next tasks are proposed and clearly prioritized.
- The report identifies capabilities that should deliberately remain
  unimplemented for now.


# Latest independent review

BLOCKED

Real relay acquisition is unavailable in the current environment, so the required two real-evidence research paths cannot be completed or reviewed.

The retained database supports the report’s limited claims: 0 events, 0 observations, 0 sets, and one failed acquisition run (`8d71b242-dd66-4486-85bd-f735125bf2ba`) covering the three named relays. A compact local query returned no results, and saved-set inspection was impossible because no set exists.

The validation script exits 1, contrary to the worker report. Its final grep does not match the report’s wording. Therefore validation has not passed, though this does not remove the external network blocker.