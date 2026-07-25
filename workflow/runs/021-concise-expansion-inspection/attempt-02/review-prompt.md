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


# Worker report

Implemented concise expansion inspection with review fixes.

- Added compact expansion dashboard with counts, capacity, uncertainty, bounds, completion reason, and failures.
- Added progressive failure compaction for the 1,000-byte minimum limit.
- Strengthened functional coverage with six unique long relay failures.
- Preserved original expansion requests and diagnostics unchanged.
- Verified raw filters and successful relay details are omitted from shown output.
- Ran full test suite: 20 passed, 6 network tests skipped by sandbox.
- Ran syntax checks, console help check, and `git diff --check`; all passed.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:78189) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78189) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (251.750667ms)
✔ global limit and cancellation are distinguishable and close owned sockets (153.682292ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (173.144792ms)
✔ timeout and partial connection failure remain observable (156.636666ms)
Expanding through 2 relay(s), depth 2, event limit 10...
✔ acquisition rejects unusable public inputs before networking (6.329125ms)
✔ console expansion rejects invalid bounds and semantics before networking (6.327541ms)
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (106.920458ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (170.952917ms)
(node:78198) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78222) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78227) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78229) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78253) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78255) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78257) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78281) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78283) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78284) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78285) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78308) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78310) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78387) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (758.631667ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (45.581791ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (197.655917ms)
(node:78191) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (247.294ms)
(node:78192) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (56.846625ms)
(node:78193) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (186.890041ms)
(node:78194) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (60.817791ms)
(node:78195) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (46.991708ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (36.121542ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (35.222167ms)
(node:78196) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1797.748625ms)
(node:78197) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (67.820667ms)
(node:78223) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78228) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78230) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78254) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78256) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78258) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:78282) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (388.947667ms)
(node:78224) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (40.991084ms)
✔ sessions start from public runs returned by recordRun and getRun (8.618125ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (13.390583ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (1.827667ms)
(node:78225) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (61.605833ms)
ℹ tests 26
ℹ suites 0
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10523.824875

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/session.js && node --check src/planning.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-memory.js && node --check bin/nostr-research-console.js

(node:78473) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.