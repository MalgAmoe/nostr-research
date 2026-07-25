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


# Worker report

Deliverables changed:
- Added exported, UI-independent targeted expansion operation.
- Corrected reply breadth budgeting and tiny-workspace seed preservation.
- Reduced console expansion to delegation, progress, and cancellation handling.
- Fixed invalid console signal handling to preserve ResearchMemoryError validation.
- Added public functional coverage and documentation updates.

Validation:
- Task validation script passed.
- Full suite: 20 passed, 6 loopback-dependent tests skipped by sandbox.
- Syntax checks passed.
- `git diff --check` passed.

Unresolved uncertainties:
- Local WebSocket scenarios could not execute because the sandbox forbids loopback listeners. No other uncertainties.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:75435) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75435) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (155.650542ms)
✔ global limit and cancellation are distinguishable and close owned sockets (131.997416ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (198.47875ms)
✔ timeout and partial connection failure remain observable (180.068208ms)
Expanding through 2 relay(s), depth 2, event limit 10...
✔ acquisition rejects unusable public inputs before networking (6.4355ms)
✔ console expansion rejects invalid bounds and semantics before networking (6.426458ms)
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (220.120083ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (130.518417ms)
(node:75444) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75469) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75495) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75497) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75521) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75523) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75525) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75527) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75551) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75552) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75553) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75555) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75587) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75656) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (798.343958ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (50.33325ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (197.608667ms)
(node:75437) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (254.889167ms)
(node:75438) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (52.927417ms)
(node:75439) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (201.476583ms)
(node:75440) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (78.287209ms)
(node:75441) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (44.799584ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (35.166792ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (48.112042ms)
(node:75442) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1853.574667ms)
(node:75443) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (58.941375ms)
(node:75468) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75496) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75498) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75522) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75524) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75526) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:75531) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (378.125625ms)
(node:75470) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (48.999209ms)
✔ sessions start from public runs returned by recordRun and getRun (11.077583ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (12.149834ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (3.23325ms)
(node:75472) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (57.21ms)
ℹ tests 26
ℹ suites 0
ℹ pass 26
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10385.243875

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/session.js && node --check src/planning.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-memory.js && node --check bin/nostr-research-console.js

(node:75720) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.