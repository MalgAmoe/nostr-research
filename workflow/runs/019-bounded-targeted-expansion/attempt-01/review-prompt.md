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
id: 019-bounded-targeted-expansion
status: in_progress
max_attempts: 5
validation: workflow/tasks/019-bounded-targeted-expansion.validate.sh
depends_on: 018-bounded-inspection-and-orientation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded targeted expansion

## Reason

Two live console investigations found useful seeds and then repeatedly required
the caller to inspect tags, copy unresolved event IDs and public keys, construct
separate relay filters for quoted events, replies, and profiles, acquire them,
reload the workspace, and traverse again. Existing acquisition and traversal
are individually sound, but this mechanical gap makes directed navigation
harder than it needs to be.

The workspace already represents a bounded disposable working corpus over
durable SQLite memory. Do not introduce a second buffer, path, frontier,
preference, or vessel abstraction.

## Objective

Expose one explicit asynchronous console operation:

```js
const expanded = await research.expand(selection, {
  relays: ['wss://relay.example/'],
  relationshipTypes: [
    'quoted-event',
    'reply-parent',
    'reply-root',
    'mentioned-account',
    'author'
  ],
  direction: 'both',
  depth: 2,
  limit: 100,
  timeoutMs: 10_000,
  eventLimit: 200,
  concurrency: 3
})
```

`selection` is an explicit shared result value. Expansion must not depend on or
mutate session selection.

## Behavior

Expansion composes the existing workspace traversal and relay acquisition:

1. traverse the supplied selection using the requested relationship semantics;
2. identify unresolved event and account targets;
3. issue the minimum practical NIP-01 filters for missing event IDs and kind-0
   account metadata;
4. when inbound reply relationships are requested, query `#e` for selected or
   reached event IDs;
5. hydrate acquired evidence into the existing workspace;
6. repeat only as needed to satisfy the requested depth; and
7. return one ordinary bounded result collection from the final traversal.

Use one operation-wide event/observation budget, timeout policy, and explicit
relay list. Never crawl in the background, silently retry indefinitely, or
claim exhaustive coverage. Deduplicate targets and filters. Stop when the
budget, depth, or lack of new targets ends the operation.

The result context must make the operation understandable without retaining
complete acquisition objects. Report at least:

- exact expansion options and starting subjects;
- workspace capacity/usage before and after;
- request/filter count;
- observations, newly stored events, duplicates, and invalid events;
- relay outcomes and diagnostics per request;
- unresolved targets before and after; and
- whether depth, traversal limit, event budget, or timeout bounded the result.

Preserve ordinary item reasons and provenance. Every discovered item must
remain explainable through traversal relationships. Complete acquisition
coverage remains available through the existing durable coverage records.

If the existing `research.summary()` does not already make memory size,
workspace usage/capacity, and current selection size obvious, improve its
labels minimally. Do not add a monitoring subsystem or duplicate the workspace
description.

## API and validation

Reject unknown options, unsupported relationship types, empty relay lists, and
invalid budgets before networking. Cancellation must propagate through the
whole expansion and release owned sockets. Partial relay failure should return
the useful evidence obtained from other relays with explicit diagnostics.

Keep orchestration cohesive in the console/research-environment layer unless a
small public library operation clearly reduces duplication. Do not move relay
policy into sessions or durable memory.

## Boundaries

- No automatic interestingness, spam, trust, or recommendation score.
- No marks, preferences, path persistence, buffer class, or fluent query DSL.
- No default relays, background acquisition, unbounded crawling, or automatic
  mutation of session selection.
- No new storage abstraction or database schema merely for expansion.
- Do not add unit tests for private filter-building helpers.

## Verification

Add one public functional scenario using real SQLite and local NIP-01 WebSocket
relays. Starting from a stored seed, it must prove that a single expansion:

- fetches a missing quoted event and its profile;
- fetches an inbound reply when requested;
- expands a second hop within the global budget;
- survives one partial relay failure;
- returns relationship reasons and relay provenance;
- reports capacity and acquisition pressure;
- leaves session selection unchanged;
- remains bounded; and
- can be retained and reopened from SQLite.

Also run the full existing suite and syntax checks. Live public relay behavior
is a field validation, not a permanent network-dependent test.

## Acceptance criteria

- A directed seed can become a bounded locally expanded evidence collection
  without manually copying IDs into several acquisition calls.
- Expansion is explicit, composable, explainable, and session-independent.
- One global budget governs the complete multi-request operation.
- Workspace pressure and partial relay outcomes are observable.
- Existing acquisition, traversal, retention, console, and session behavior
  remain intact.


# Worker report

Implemented bounded targeted expansion.

Deliverables:

- Added `research.expand(selection, options)` with validation, global budgets, cancellation, deduplicated filters, workspace hydration, depth-aware traversal, diagnostics, and session independence.
- Added functional coverage for validation and local NIP-01 multi-hop expansion.
- Documented the new console API.

Validation:

- Full task validation passed.
- Full existing suite passed: 20 passed, 5 skipped.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainty:

- Local WebSocket relay scenarios were skipped because this sandbox forbids loopback listeners; the permanent scenario is included for environments permitting them.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:65252) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65252) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (152.719834ms)
✔ global limit and cancellation are distinguishable and close owned sockets (192.925834ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (167.973416ms)
✔ timeout and partial connection failure remain observable (158.769542ms)
Expanding 1 subject(s) through 2 relay(s), depth 2, event limit 10...
✔ acquisition rejects unusable public inputs before networking (16.705ms)
✔ console expansion rejects invalid bounds and semantics before networking (10.295166ms)
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (103.569083ms)
(node:65261) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65290) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65315) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65317) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65319) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65342) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65345) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65347) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65370) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65371) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65372) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65373) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65397) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65452) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (753.639209ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (44.646666ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (194.231959ms)
(node:65254) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (246.918791ms)
(node:65255) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (63.953042ms)
(node:65256) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (191.002625ms)
(node:65257) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (65.994959ms)
(node:65258) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (43.843417ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (20.796167ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (47.989666ms)
(node:65259) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1953.006ms)
(node:65260) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (56.872625ms)
(node:65287) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65314) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65316) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65318) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65343) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65344) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:65346) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (359.3255ms)
(node:65288) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (63.555125ms)
✔ sessions start from public runs returned by recordRun and getRun (12.150334ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (12.423417ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (2.021125ms)
(node:65289) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (74.815416ms)
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10420.9595

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/session.js && node --check src/planning.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-memory.js && node --check bin/nostr-research-console.js

(node:65517) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.