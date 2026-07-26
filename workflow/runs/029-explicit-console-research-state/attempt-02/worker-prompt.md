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
| **session** | The temporary, in-process owner of the console's explicitly activated selection and its last meaningful state action. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **retained selection** | A deliberately retained, named result collection with its subjects and reasons for later inspection during the running process. |
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
- provenance detail and retained-selection semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the only authoritative corpus. A session owns only the console's
explicitly activated selection and its last state action. All query,
acquisition, expansion, reply-context, filtering, facet, comparison,
inspection, and traversal operations return values without changing that
selection. Activation is a separate explicit operation. Retaining a supplied
result and checkpointing the active selection are distinct operations. A result
collection is the shared operation result passed between these layers. Retained
selections disappear with the corpus; sessions are not serialized.

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


# Selected task

---
id: 029-explicit-console-research-state
status: in_progress
max_attempts: 5
validation: workflow/tasks/029-explicit-console-research-state.validate.sh
depends_on: 028-prune-inactive-research-api
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make console research state explicit and finish the cleanup

## Objective

Make the persistent JavaScript console predictable: research operations return
values, and changing the active investigation is an explicit operation. Then
simplify session and presentation code around the smaller data model delivered
by task 028.

## Required behavior

- Local query, acquisition, expansion, reply-context resolution, filtering,
  facets, comparison, inspection, and traversal do not implicitly replace the
  active selection.
- One plainly named operation explicitly makes a result the active selection.
- Explicit traversal has one signature and one mutation behavior; do not
  overload argument count to switch between stateful and stateless operation.
- Retaining an explicit result and checkpointing the active selection have
  distinct names and signatures.
- Console status reports one authoritative corpus description rather than
  duplicate memory/corpus summaries.
- Closing the environment still cancels operations it owns.

Review the temporary session against actual console use. Keep a session module
where it contains genuine active-navigation state, but remove unused
focus/include/exclude/branch/view machinery if its complexity does not reappear
in the console. Do not preserve operations solely because old tests call them.
Backtracking or checkpoint behavior may remain only if it has a clear,
non-overloaded console operation.

Simplify presentation after removed run, coverage-registry, and generic-set
shapes disappear. Compact traversal and expansion output should summarize
relationship evidence by default rather than embedding large nested reason
structures; detailed inspection must remain available on request.

Finally reassess source locality. Extract a module only when it owns a coherent
implementation concern and makes callers simpler. Leaving the reduced core in
one file is acceptable; creating pass-through modules is not.

## Boundaries

- Do not add a UI, command language, database, persistence, browser bundler, or
  plugin/widget system.
- Do not rename the entire memory/corpus vocabulary as cosmetic churn.
- Do not introduce controllers, services, repositories, dependency injection,
  or generic adapters.
- Keep dynamic JavaScript composition and the process-lifetime REPL.
- Test public console workflows and protocol rules, not helper implementation
  details.

## Documentation and verification

Update active README, console help, and canonical context to describe the exact
remaining console operations and explicit state rule.

Run a console-driven functional scenario that:

1. imports or acquires evidence;
2. performs multiple local queries without changing active state;
3. explicitly activates one result;
4. traverses it without hidden mutation;
5. explicitly activates the traversal;
6. retains findings; and
7. inspects both compact and detailed output.

## Acceptance criteria

- Console operations have predictable mutation semantics.
- There are no overloads whose argument count changes whether session state is
  mutated.
- Session code contains only capabilities available and useful through the
  active console workflow.
- Compact presentation is bounded and detailed evidence remains inspectable.
- Documentation matches the actual interface.
- No speculative architecture is introduced.
- Functional tests, syntax checks, and the console scenario pass.


# Latest independent review

CHANGES_REQUIRED

1. `README.md:18` documents `--capacity 10000`, but the console accepts only `1-1000` (`packages/nostr-research/src/console.js:17`). Update the launch example to a valid capacity so the active README matches the actual interface.