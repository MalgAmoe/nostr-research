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
id: 021-concise-expansion-inspection
status: in_progress
max_attempts: 4
validation: workflow/tasks/021-concise-expansion-inspection.validate.sh
depends_on: 020-correct-reusable-expansion
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make expansion inspection concise

## Reason

`research.show(expanded)` currently compacts traversal relationships but
retains the complete expansion report, including every generated filter and
per-relay response. Real investigations showed that this overwhelms the useful
result preview and can approach the presentation size guard.

Complete diagnostics are valuable and must remain available on the original
collection. Normal inspection needs an instrument panel rather than a network
trace.

## Objective

When a result collection contains `context.expansion`, make
`research.show(collection)` present a compact expansion summary containing:

- starting and resulting subject counts;
- request/filter count;
- observations, newly stored, duplicate, and invalid counts;
- workspace event usage and capacity before and after;
- unresolved event/account counts before and after;
- completion reason;
- depth, traversal-limit, event-budget, timeout, and cancellation bounds; and
- concise partial relay failures with relay and diagnostic.

Do not include successful per-relay responses, complete generated filters, or
complete request objects in the ordinary shown context. Preserve them,
unchanged, on the original `collection.context.expansion.requests`.

The summary must remain meaningful when the overall presentation size limit is
small. It should not require callers to guess internal properties merely to
understand whether expansion succeeded or was bounded.

## Boundaries

- No changes to expansion acquisition behavior.
- No new logging, monitoring, telemetry, or persistence.
- No generic presentation framework.
- No authored-note expansion.
- Do not remove access to complete diagnostics.

## Verification

Use a public inspection scenario with a synthetic expanded collection
containing many requests and relay diagnostics. Prove that:

- shown output stays within the configured size bound;
- the compact dashboard retains all required operational signals;
- partial failures remain visible;
- successful relay response detail and raw filters are omitted from shown
  output; and
- the original collection remains complete and unchanged.

Run the complete suite and syntax checks.

## Acceptance criteria

- Expansion inspection is concise enough for routine console use.
- Capacity, acquisition pressure, uncertainty, and failures remain visible.
- Complete diagnostics remain available without dominating `show`.
- Existing presentation of non-expansion collections remains stable.


# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/presentation.js`: up to five failures are retained with 160-character diagnostics and unbounded relay strings. At the minimum 1,000-byte size limit, several unique failures can make the summary exceed the bound; `enforceSize()` then replaces the entire expansion dashboard with the generic `{ bounded, note }` context, losing all required operational signals and failures. Make expansion-specific size enforcement progressively compact failures while preserving the dashboard. Update the functional scenario to use several unique relay failures; the current repeated identical failure is deduplicated to one and does not exercise this case.