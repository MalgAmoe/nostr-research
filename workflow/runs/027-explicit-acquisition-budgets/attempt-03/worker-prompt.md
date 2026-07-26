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

- Memory is one capacity-bounded, process-local corpus shared by the library,
  CLI, functional verification, and future applications.
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
- Persistence and a database format are deliberately absent. Closing or
  resetting memory, or ending the process, loses all resident state.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The bounded process-local research corpus of evidence, observations, and replaceable derived material. |
| **session** | A temporary, in-process research playground coordinating selection, focus, provisional exclusions, branches, and meaningful actions over memory. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **focus** | An optional subject receiving attention in a session; it is independent of and does not rewrite the selection. |
| **temporary branch** | A session-local named snapshot of selection, focus, and exclusions used to revisit an exploratory path; it is not durable evidence. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | A process-local record of one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One process-local recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it; unlike a session, it is an immutable operation snapshot. |
| **research set** | A deliberately retained, named group of subjects for later inspection or expansion during the running process. |
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
- provenance detail and process-local research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the only authoritative corpus. A session coordinates selection, focus,
exclusions, history, and temporary branches over memory operations. A result
collection is the shared operation result passed between these layers. A research
set is a process-local checkpoint; a research run is a process-local account of an
operation. Retained groups, runs, and coverage disappear with the corpus. Sessions
and branches are not serialized.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
records bounded acquisition coverage. Coverage says that a precise
relay/filter/budget attempt occurred. It never says that the relay or time
window was exhaustively indexed.

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


# Selected task

---
id: 027-explicit-acquisition-budgets
status: in_progress
max_attempts: 5
validation: workflow/tasks/027-explicit-acquisition-budgets.validate.sh
depends_on: 026-remove-sqlite
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make acquisition budgets explicit and semantically correct

## Objective

Correct the mismatch between relay observations and distinct Nostr events.
Acquisition and expansion must expose separate, plainly named bounds so callers
can control relay work without mistaking duplicate observations for new events.

## Required behavior

- Replace the misleading public `eventLimit` option with explicit observation
  and distinct-event budgets. There is no compatibility requirement for the old
  name.
- The observation budget is a hard operation-wide bound on accepted valid
  `EVENT` messages across all relays.
- The distinct-event budget is a hard operation-wide bound on unique canonical
  event IDs acquired by the operation.
- Completion and reports identify which bound stopped the operation.
- Counts and budget reports consistently distinguish received packets, accepted
  observations, duplicate observations, newly stored corpus events, and
  distinct events acquired by the operation.
- Authored-note limits count distinct authored event IDs per starting account,
  not observations returned by multiple relays.
- Expansion and reply-context resolution propagate the new budget vocabulary
  and never silently reinterpret one kind of limit as another.
- Console progress and presentation use the same terminology.

The implementation must remain bounded under duplicate-heavy relay responses.
It is acceptable for an observation bound to stop an operation before its
distinct-event target is reached; that uncertainty must be visible rather than
hidden.

## Boundaries

- Do not add adaptive relay heuristics, retries, persistence, or quality rules.
- Do not encode assumptions about which relay is authoritative.
- Do not redesign the corpus, sessions, retained selections, or presentation
  architecture in this task.
- Avoid unit tests for option plumbing. Exercise the public acquisition and
  expansion boundaries with duplicate relay observations.

## Documentation

Update active README and canonical context where they describe acquisition
budgets. Historical task definitions and field-trial artifacts remain
historical records.

## Acceptance criteria

- No active public option or active documentation calls an observation bound
  `eventLimit`.
- Direct acquisition enforces and reports both bounds.
- Duplicate observations do not consume the distinct-event budget.
- Authored-note expansion limits distinct notes per account.
- Acquisition, expansion, and reply-context reports use coherent counts.
- Existing cancellation, timeout, relay outcome, provenance, and corpus
  capacity behavior remains intact.
- Functional tests and syntax checks pass.


# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/expansion.js:77` builds relay filter limits using only the distinct-event remainder, ignoring the smaller observation remainder. This produces authored filter limits `[2, 2]` instead of `[2, 1]` and reply breadth `100` instead of `12`. Bound filter limits by both remaining budgets while preserving per-account authored distinct limits.

2. The required validation fails: 2 of 26 functional tests fail at `acquisition.functional.test.js:522` and `:923`. All functional tests must pass before acceptance.