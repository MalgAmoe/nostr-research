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
id: 020-correct-reusable-expansion
status: in_progress
max_attempts: 5
validation: workflow/tasks/020-correct-reusable-expansion.validate.sh
depends_on: 019-bounded-targeted-expansion
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make targeted expansion correct and reusable

## Reason

Live use and three independent reviews found two correctness risks in the
current targeted expansion:

- inbound reply acquisition sets the relay filter limit to the number of
  target event IDs, so one selected note requests at most one reply even when
  the global budget allows a larger conversation; and
- expansion claims to keep explicit event seeds resident, but re-adding an
  existing workspace record does not change its FIFO position, so a seed may
  be evicted when a small workspace is full.

Expansion is also genuine library research behavior but is implemented inside
the persistent-console adapter. Other JavaScript consumers cannot use it
without constructing a console environment.

## Objective

Expose targeted expansion through the package's exported library surface and
make its bounds truthful under conversation breadth and workspace pressure.
Keep the console as a thin consumer of that operation.

The exported API name and exact parameter packaging may follow the existing
library vocabulary, but it must accept an open memory, bounded workspace,
explicit selection, and the established expansion options without depending
on a REPL or session.

## Correct reply breadth

For inbound `reply-parent` or `reply-root` expansion:

- query only kind-1 notes carrying `#e` references to reached event IDs;
- do not equate reply breadth with the number of target IDs;
- let the remaining operation-wide event/observation budget bound the request;
- preserve the existing global timeout, traversal limit, and depth;
- deduplicate target IDs and filters; and
- report when the budget prevents further reply acquisition.

Do not introduce automatic pagination or claim an exhaustive thread.

## Seed residency

Build a deterministic functional reproduction with a workspace whose capacity
is smaller than the seed plus all acquired evidence. The final result and
report must remain truthful:

- explicit starting event subjects remain traversable throughout the
  operation;
- acquisition may evict other disposable workspace evidence according to a
  simple documented policy;
- workspace capacity is never exceeded;
- evictions remain observable; and
- durable SQLite evidence is never lost.

Choose the smallest cohesive workspace mechanism needed to preserve expansion
starts. Do not create a Buffer, Vessel, cargo manager, or general cache-policy
framework.

## Library boundary

Move expansion orchestration and validation out of `src/console.js` into a
cohesive exported library operation. The console wrapper should retain only:

- progress messages;
- ownership/cancellation of active interactive operations; and
- convenient binding on `research.expand`.

Share the relationship vocabulary or traversal option validation only where
the extraction naturally requires it. Do not broadly refactor memory and
workspace traversal algorithms in this task.

## Boundaries

- No authored-note sampling yet.
- No presentation redesign.
- No mutation of session selection.
- No default relays, retries, crawling, scoring, or automatic relevance.
- No broad JavaScript-interface redesign.
- No tests of private filter-building helpers.

## Verification

Use public functional boundaries with real SQLite and local NIP-01 WebSocket
relays to prove:

- a seed with more than ten available replies retrieves multiple replies under
  an adequate global budget;
- lowering the global budget bounds reply acquisition;
- a full tiny workspace does not lose explicit expansion starts;
- partial relay failure preserves useful results and diagnostics;
- cancellation releases sockets;
- the exported operation works without the console environment;
- the console delegates to the same operation and leaves session selection
  unchanged; and
- retained results reopen from SQLite.

Run the complete existing suite and syntax checks.

## Acceptance criteria

- Conversation expansion is not silently limited to one reply per seed.
- Expansion starts remain usable under real workspace pressure.
- Expansion is part of the exported UI-independent library.
- The console does not own duplicate expansion behavior.
- Existing bounds, reasons, provenance, coverage, and retention remain intact.


# Latest independent review

CHANGES_REQUIRED

1. `src/console.js:128-130` accesses `options.signal.addEventListener()` before the exported operation validates it. An invalid signal therefore throws a raw `TypeError`, bypassing the intended `ResearchMemoryError` validation in `src/expansion.js:218-220`. Update the console delegation so established expansion input validation remains intact, and add public-boundary coverage for an invalid signal.