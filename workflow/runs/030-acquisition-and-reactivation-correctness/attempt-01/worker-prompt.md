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
id: 030-acquisition-and-reactivation-correctness
status: in_progress
max_attempts: 5
validation: workflow/tasks/030-acquisition-and-reactivation-correctness.validate.sh
depends_on: 029-explicit-console-research-state
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Correct acquisition trust, composed budgets, and retained reactivation

## Objective

Fix four correctness gaps found by the post-refactor code review without
expanding the architecture:

1. only ingest relay events that match the exact NIP-01 filter requested;
2. count distinct events once across every nested request in one composed
   expansion or reply-context operation;
3. reject unknown direct-acquisition options; and
4. allow retained selections to become the active console selection again.

## Relay filter trust

After canonical event validation, verify that an `EVENT` received for a
subscription satisfies the normalized filter sent in its `REQ`. Use the
protocol implementation supplied by `nostr-tools` when suitable rather than
creating a partial local interpretation.

A canonical but non-matching event:

- must not be ingested;
- must not consume observation or distinct-event budgets;
- must not appear in acquired observations or additions;
- must be observable in per-relay and aggregate diagnostics/counts; and
- must not make coverage claim that it was evidence returned for the requested
  slice.

Malformed packets and invalid canonical events retain their existing distinct
reporting.

## Composed distinct-event budgets

Expansion and reply-context resolution issue several sequential relay
requests. Their distinct-event limits are operation-wide, so events already
counted by an earlier request must not consume the remaining distinct-event
allowance again.

Keep the low-level direct acquisition operation independently useful. Deepen
its existing budget implementation or otherwise centralize the accounting;
do not add a generic orchestration framework. Reports must continue to expose
per-request counts while aggregate counts describe distinct IDs across the
complete composed operation.

Add functional scenarios where a later filter first returns an event obtained
by an earlier filter and then returns a genuinely new event. The new event must
still be acquired when the operation has distinct-event capacity for it.

## Acquisition option validation

Direct acquisition must reject unknown option keys before networking. This
includes the removed `eventLimit` name. It must never silently fall back to
default limits when the caller misspells or uses an obsolete bound.

Expansion and reply-context option validation remain coherent with this rule.

## Retained-selection activation

Both the summary returned by `retain()` and the full retained selection from
`getSet()` must be accepted by the explicit console/session activation
operation. Reuse one canonical retained-selection-to-collection conversion
path for construction and later activation.

Reactivation restores subjects and retained reasons without contacting relays,
mutating canonical evidence, or claiming that evicted evidence is resident.

## Boundaries

- Do not add relay trust scores, retry policy, persistence, pagination, or
  automatic session mutation.
- Do not introduce an acquisition service, repository, adapter hierarchy, or
  generic budget framework.
- Do not restore removed runs, coverage history, or set algebra.
- Permanent tests should exercise the public acquisition, composed-operation,
  and console/session seams. Do not expose private helpers for testing.

## Documentation

Update active README and canonical context where trust validation, composed
budgets, or retained reactivation need clarification. Historical tasks and
field-trial artifacts remain historical records.

## Acceptance criteria

- Non-matching canonical relay events are rejected before ingestion and
  explicitly counted.
- Coverage and acquired collections contain only canonical matching events.
- Observation and distinct-event limits remain hard bounds.
- Expansion and reply-context distinct limits count an ID only once across all
  nested requests.
- Unknown acquisition options fail before any relay is contacted.
- A retained summary and a full retained selection can both be explicitly
  activated.
- Query, acquisition, expansion, and traversal remain stateless with respect
  to active selection.
- All functional tests and syntax checks pass, including loopback relay tests.
