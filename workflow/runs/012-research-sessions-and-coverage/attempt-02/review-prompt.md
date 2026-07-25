# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
repository source, deliverables, task state, or workflow records. Do not repair
the work. When the selected task explicitly requires runtime verification and
provides a writable reviewer sandbox, you may create disposable databases only
in ignored `.data/` paths or the system temporary directory.

The first non-empty line of your response must be exactly one of:

- `PASS`
- `CHANGES_REQUIRED`
- `BLOCKED`

Use `PASS` only when all acceptance criteria are materially satisfied.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish.

Use `BLOCKED` only when completion requires a human decision or unavailable
external information.


# Canonical project context

# Project context

## Purpose

This project is a tool for research, navigation, and exploration of Nostr. It
is not being shaped as a conventional feed client. Its job is to help a person
acquire evidence, inspect it, navigate relationships, preserve useful sets,
and understand why a result is present.

The product foundation is a UI-independent library. A CLI, functional
verification, and future user interfaces are consumers of that library; a UI
does not define the domain boundary. The first Solid application was an
experiment and has been removed. Its retained lessons may inform future work,
but its controllers, browser persistence, scoring rules, and module layout are
not a target architecture.

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
- which future UI workflows, if any, should consume the library.

The removed experiment contained candidate behavior in these areas but did not
settle them. Its retained lessons are documented in
`docs/solid-experiment-lessons.md`; its IndexedDB/localStorage persistence,
Solid state, relay cache policy, and editorial scoring heuristics must not be
recreated by default.

## Playground boundaries

A session is the smallest UI-independent coordinator over memory operations.
Its selection, focus, exclusions, history, and temporary branches are
replaceable process state. A research set is the explicit durable checkpoint
of chosen subjects and reasons; a research run is a durable account of an
operation. Neither a session nor its branches are serialized as a whole.

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
id: 012-research-sessions-and-coverage
status: in_progress
max_attempts: 5
validation: workflow/tasks/012-research-sessions-and-coverage.validate.sh
depends_on: 011-reliable-memory-and-results
protected_paths: docs/solid-experiment-lessons.md workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add temporary research sessions and acquisition coverage

## Objective

Define the smallest UI-independent research playground coordinator over the
reliable memory and shared result vocabulary.

A session represents temporary exploration: current selection, focus, useful
branches, exclusions, and meaningful actions. It is not canonical evidence,
not browser UI state, and not automatically durable.

At the same time, make bounded acquisition coverage explicit enough that a
session can decide what evidence is locally present and what bounded relay work
was already attempted.

## Session semantics

Provide a public session module that can:

- start from an empty selection, result collection, run, or research set;
- expose the current selection and optional focused subject;
- replace the current selection with a new result;
- include or exclude subjects provisionally;
- branch from the current selection under a temporary session-local name;
- return to an earlier meaningful state;
- apply selection or traversal through the existing memory operations;
- checkpoint a chosen state into a durable research set; and
- explain the meaningful action that produced the current state.

Session actions should use a small explicit vocabulary such as observe, focus,
select, include, exclude, traverse, compare, acquire, retain, branch, and back.
Names may be sharpened by implementation, but do not record incidental UI
actions, scrolling, open panels, or every inspection.

Temporary branches and history may remain in process for this milestone.
Do not invent permanent session serialization or compatibility formats.

## Views

A view reads a session selection and returns a projection or derived grouping;
it does not own or mutate the selection.

Support at least subject-list and account-list views through the existing
projection machinery. Leave thread as a composed view. Do not implement
ranking, dashboards, or graph visualization.

## Acquisition coverage

Persist enough acquisition context to answer:

- which explicit relays were contacted;
- the exact NIP-01 filter, including supplied bounds;
- operation budget and completion reason;
- each relay outcome;
- observed event IDs and observation times; and
- whether a requested relay/time/filter slice was previously attempted.

Coverage describes attempts and observations, not a claim that a relay or time
window was exhaustively indexed.

Extend acquisition so its result can enter the same reusable result vocabulary
and become a session selection without CLI translation.

## Polite bounded planning

Add only evidence-backed planning primitives needed now:

- explicit relay concurrency, timeout, and event budgets;
- deterministic time slicing of a caller-supplied time range and target;
- optional NIP-11 relay information retrieval with a bounded timeout;
- respect for advertised maximum query limit when available; and
- parsing of NIP-65 kind-10002 read/write relay lists as stored evidence.

The caller remains in control. Do not add default public relays, retry storms,
automatic relay scoring, hidden fallback policy, or network-wide crawling.

## Documentation

Document the distinction between:

- memory, session, selection, focus, temporary branch, research set, run, and
  acquisition coverage;
- local selection and relay acquisition; and
- advertised relay capability versus observed relay behavior.

Update `CONTEXT.md` with the settled playground terms introduced here.

## Scope boundaries

- Do not build application UI.
- Do not serialize complete sessions.
- Do not introduce opaque interestingness, spam, trust, or relay scores.
- Do not add general job orchestration, command buses, or event sourcing.
- Do not assume NIP-11 claims are accurate; retain them as advertised
  information.

## Verification

Use a small number of public functional scenarios:

- begin with a selection, focus, include/exclude, traverse, branch, back, and
  checkpoint; verify temporary changes do not mutate evidence or saved sets;
- close/reopen memory and continue from the checkpoint;
- record two bounded acquisition slices and distinguish covered attempts from
  unattempted windows; and
- validate NIP-11 limit handling and NIP-65 parsing with stable protocol-level
  examples.

The reviewer must drive the session through the public library rather than
testing private state.

## Acceptance criteria

- A UI, CLI, or agent can drive the same session actions.
- Current selection and focus are temporary and independently replaceable.
- Branch/back behavior preserves earlier selections without copying evidence.
- Exclusions are session-local unless deliberately checkpointed as reasons.
- Checkpoints use atomic durable retention.
- Acquisition returns a reusable result collection.
- Coverage is durable, bounded, and explicit about uncertainty.
- Planning primitives remain caller-controlled and relay-considerate.



# Worker report

Implemented both review fixes:

- Excluding a focused subject no longer clears session focus.
- relayQueryLimit() now accepts fetchRelayInformation() results directly, while retaining raw NIP-11 document support.
- Added public functional regressions covering both behaviors.

Validation performed:

- Targeted functional tests: 3 passed.
- Full package suite: 14 passed, 4 network tests skipped because loopback listeners are sandbox-blocked.
- Syntax checks passed.
- Task validation script passed.
- git diff --check passed; no debug instrumentation remains.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:71817) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71817) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (126.20425ms)
✔ global limit and cancellation are distinguishable and close owned sockets (153.076333ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (171.706666ms)
✔ timeout and partial connection failure remain observable (167.07225ms)
✔ acquisition rejects unusable public inputs before networking (5.59575ms)
(node:71825) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71849) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71873) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71875) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71877) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71901) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71903) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71904) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71927) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71928) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71929) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71930) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71933) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71981) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (742.979166ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (47.867542ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (196.696042ms)
(node:71819) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (50.293125ms)
(node:71820) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (39.253166ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (26.880959ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (34.478125ms)
(node:71821) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1854.679625ms)
(node:71822) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (54.482167ms)
(node:71823) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71848) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71872) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71874) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71876) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71900) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:71902) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (408.947542ms)
(node:71824) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (55.538042ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (11.95725ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (3.512833ms)
ℹ tests 18
ℹ suites 0
ℹ pass 18
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10353.257167

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/session.js && node --check src/planning.js && node --check bin/nostr-research-memory.js

(node:72033) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.