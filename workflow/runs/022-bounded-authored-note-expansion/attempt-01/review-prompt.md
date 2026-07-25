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
id: 022-bounded-authored-note-expansion
status: in_progress
max_attempts: 5
validation: workflow/tasks/022-bounded-authored-note-expansion.validate.sh
depends_on: 021-concise-expansion-inspection
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded authored-note expansion

## Reason

The bookstore field trial reached an author account and profile, then naturally
needed a small sample of that account's notes to understand the creator's
actual activity. Current `author` traversal only exposes authored events
already loaded in the workspace; targeted expansion resolves an account to
kind-0 metadata but cannot explicitly acquire authored notes.

This is an evidence-backed navigation direction. It must remain deliberate and
bounded rather than becoming automatic account crawling.

## Objective

Extend the exported expansion operation with an explicit option for acquiring
a bounded recent sample of kind-1 notes authored by explicit starting account
subjects.

The exact option name may follow the established API, but usage should be
clear, for example:

```js
await research.expand(accounts, {
  relays,
  relationshipTypes: ['author'],
  direction: 'inbound',
  authoredLimit: 10,
  depth: 2,
  limit: 50,
  eventLimit: 100
})
```

## Semantics

- The option is disabled by default.
- It requires the `author` relationship and an inbound-capable direction.
- It applies only to explicit starting account subjects, not every account
  discovered later.
- It requests only kind-1 notes with a clear recent ordering assumption as
  supported by NIP-01 relay filters.
- It has an explicit positive bound and also consumes the operation-wide
  event/observation budget.
- Multiple starting accounts must not silently allow one account to exceed the
  declared per-account intention; use simple explicit requests if necessary.
- Returned notes must carry ordinary author relationship reasons and relay
  provenance.
- The session selection remains unchanged.
- Expansion reporting identifies authored-note requests and all normal bounds.

Do not generalize this into arbitrary account feeds, recommendation, following,
or background synchronization.

## Directed field trial

Use the real persistent JavaScript console to:

1. reopen the retained `nostr-bookstore-creator-commerce-seed` evidence when
   locally available, or reconstruct an equivalent disposable seed from live
   public relays;
2. select the novelist account explicitly;
3. acquire a small recent authored-note sample;
4. inspect and orient that sample;
5. expand one promising note through an existing protocol relationship if
   useful;
6. retain only worthwhile evidence; and
7. reopen the retained set.

Record exact commands, operational counts, evidence-backed findings, and API
friction in `workflow/artifacts/authored-note-expansion-field-trial.md`.
Public relay availability is field evidence, not a permanent test dependency.

## Boundaries

- No automatic authored-note acquisition for encountered accounts.
- No follows/feed generation, scoring, categorization, or interest model.
- No pagination framework or exhaustive-history claim.
- No UI, screenshots, presets, or query DSL.
- No broad session or JavaScript-interface redesign.

## Verification

Use a public functional scenario with real SQLite and local NIP-01 WebSocket
relays proving:

- the option is explicit and validated before networking;
- one and multiple account starts remain bounded as declared;
- non-starting discovered accounts are not sampled automatically;
- the global budget still governs the complete expansion;
- reasons, provenance, partial failures, and session independence survive;
- results retain and reopen; and
- default expansion behavior remains unchanged.

Run the complete suite and syntax checks.

## Acceptance criteria

- A selected account can explicitly yield a small recent authored-note sample.
- The operation remains bounded, explainable, and session-independent.
- Discovered accounts do not trigger implicit feed acquisition.
- The live trial validates whether this supports continued research.
- Existing expansion behavior remains usable.


# Worker report

Implemented bounded authored-note expansion.

Deliverables changed:
- Added explicit validated `authoredLimit` expansion option.
- Added per-start-account kind-1 relay requests, global budget enforcement, provenance, and reporting.
- Updated console progress, compact inspection, README, and functional scenarios.
- Added `workflow/artifacts/authored-note-expansion-field-trial.md`.

Validation:
- Full `npm test` passed: 20 passed, 8 loopback tests skipped by sandbox restrictions.
- Syntax checks and task validation script passed.
- `git diff --check` passed.
- Persistent-console field trial completed; retained set reopened successfully.

Unresolved uncertainties:
- Sandbox DNS blocked all public relay connections, so fresh live-note quality could not be assessed. Failures and exact operational counts are documented.
- Local WebSocket scenarios could not execute in this sandbox, though their functional coverage was added.

# Validation output

Exit code: 1


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:80170) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80170) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (138.236166ms)
✔ global limit and cancellation are distinguishable and close owned sockets (199.683916ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (189.633917ms)
✔ timeout and partial connection failure remain observable (128.283958ms)
✔ acquisition rejects unusable public inputs before networking (6.038333ms)
✔ console expansion rejects invalid bounds and semantics before networking (6.832875ms)
✖ authored-note expansion samples only explicit account starts within per-account and global bounds (139.189916ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (60.462333ms)
Expanding through 2 relay(s), depth 2, event limit 10...
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (59.620625ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (139.771375ms)
(node:80179) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80202) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80233) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80235) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80237) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80261) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80263) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80265) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80267) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80290) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80291) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80298) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80324) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80418) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (767.364375ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (46.986458ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (194.26775ms)
(node:80172) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (260.225208ms)
(node:80173) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (50.616875ms)
(node:80174) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (215.872458ms)
(node:80175) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (61.403875ms)
(node:80176) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (53.960958ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (32.962542ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (49.725042ms)
(node:80177) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1808.123166ms)
(node:80178) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (65.669375ms)
(node:80205) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80234) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80236) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80260) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80262) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80264) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:80266) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (382.1605ms)
(node:80207) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (54.350708ms)
✔ sessions start from public runs returned by recordRun and getRun (9.072458ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (9.628375ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (2.371417ms)
(node:80209) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (57.948625ms)
ℹ tests 28
ℹ suites 0
ℹ pass 27
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10419.248208

✖ failing tests:

test at test/acquisition.functional.test.js:264:1
✖ authored-note expansion samples only explicit account starts within per-account and global bounds (139.189916ms)
  AssertionError [ERR_ASSERTION]: one explicit account receives one bounded recent note
  
  0 !== 1
  
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:325:12)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }
npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path /Users/malg/Documents/Codex/nostr/packages/nostr-research
npm error workspace @nostr-research/memory@0.1.0
npm error location /Users/malg/Documents/Codex/nostr/packages/nostr-research
npm error command failed
npm error command sh -c node --test


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.