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
id: 014-persistent-javascript-research-console
status: in_progress
max_attempts: 5
validation: workflow/tasks/014-persistent-javascript-research-console.validate.sh
depends_on: 013-in-memory-research-workspace
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add a persistent JavaScript research console

## Objective

Create the smallest persistent application an agent can actually operate: a
Node JavaScript REPL backed by the library, an in-memory workspace, and SQLite
persistence.

JavaScript is the interaction language. Do not invent a command grammar,
network API, or graphical interface.

## Console lifecycle

Add a package executable and root launcher that can:

- open a caller-supplied SQLite database;
- create a bounded in-memory research workspace;
- start Node's interactive REPL with top-level `await`;
- keep JavaScript variables and the workspace alive between commands;
- close relay resources, workspace resources, and memory cleanly on exit; and
- return useful non-zero failures for invalid startup arguments.

The executable must work both interactively through a PTY and non-interactively
when JavaScript is piped into standard input for functional verification.

## Prepared environment

Expose one compact `research` object as the primary entry point. It should make
the common research loop natural:

- inspect workspace and durable-memory summaries;
- load a bounded stored corpus;
- acquire explicit bounded relay data into memory and the workspace;
- search events and accounts;
- reuse or replace the current session selection;
- inspect, traverse, compare, and retain results; and
- access the underlying public `memory`, `workspace`, and `session` when deeper
  library operations are needed.

Do not wrap every library method. Prefer a few meaningful conveniences and
direct access to the established public objects.

Useful results must remain ordinary JavaScript values that can be assigned,
filtered, combined, and passed into later operations.

## Output

Interactive inspection must be bounded and readable:

- large collections print their identity, count, context, and a small preview;
- complete values remain programmatically available;
- progress from long acquisition is visible without flooding output; and
- errors preserve useful operation context.

Use standard Node inspection facilities or a small cohesive formatter. Do not
create parallel rendered data models.

## Boundaries

- No browser or desktop UI.
- No screenshots or visual evaluation.
- No HTTP server, daemon, socket protocol, or remote code execution.
- No custom language or parser.
- No automatic public relays, background acquisition, crawling, ranking, or
  hidden research policy.
- Do not make incidental REPL variables durable.

## Documentation

Document startup, shutdown, prepared bindings, top-level `await`, assignment and
reuse of results, loading versus acquisition, and one short multi-step example.

## Verification

Use a public process-boundary functional scenario that starts one console
process, sends multiple JavaScript expressions, and proves:

- a variable created by one expression is usable by a later expression;
- a stored corpus loads into the workspace;
- search, traversal or inspection, session selection, and retention compose;
- output remains bounded for a large result; and
- exiting closes the database so it can immediately be reopened.

Do not test private formatter helpers or Node REPL internals.

## Acceptance criteria

- The console is a persistent JavaScript environment, not repeated CLI calls.
- Top-level `await` and persistent variables work.
- The `research` object drives the real library and in-memory workspace.
- Ordinary results are composable JavaScript values.
- Interactive rendering cannot accidentally dump an entire realistic corpus.
- Clean exit leaves durable evidence usable.
- Existing CLI and library entry points continue to work.
