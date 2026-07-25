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

Deliverables changed:

- Fixed authored-note functional assertions to resolve traversal subjects through durable memory.
- Made the local WebSocket relay fixture preserve partial TCP frames.
- Existing bounded authored-note expansion implementation and field-trial artifact remain in place.

Validation:

- `npm test`: 20 passed, 0 failed, 8 network/loopback tests skipped by sandbox.
- Syntax checks and console help check passed.
- `git diff --check` passed.

Unresolved uncertainty:

- The required successful live public-relay trial remains blocked: DNS and outbound connections are unavailable (`ENOTFOUND`; direct-IP connection also rejected). The artifact honestly records the unsuccessful trial, so review finding 2 is not resolved in this environment.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:81956) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:81956) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (133.817875ms)
✔ global limit and cancellation are distinguishable and close owned sockets (274.5565ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (176.465958ms)
✔ timeout and partial connection failure remain observable (171.059625ms)
✔ acquisition rejects unusable public inputs before networking (6.181292ms)
✔ console expansion rejects invalid bounds and semantics before networking (5.9995ms)
Expanding through 2 relay(s), depth 2, event limit 10, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 observation(s), 7 workspace event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (172.154459ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (79.084292ms)
Expanding through 2 relay(s), depth 2, event limit 10...
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (79.870875ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (139.244334ms)
(node:81965) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:81991) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82017) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82019) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82021) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82023) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82047) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82049) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82051) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82052) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82075) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82076) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82080) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82149) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (777.821166ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (47.712333ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (189.575458ms)
(node:81958) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (267.948375ms)
(node:81959) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (60.041041ms)
(node:81960) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (184.989791ms)
(node:81961) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (73.4425ms)
(node:81962) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (41.820209ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (32.697792ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (36.956917ms)
(node:81963) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1804.016875ms)
(node:81964) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (73.237917ms)
(node:81990) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82018) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82020) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82022) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82024) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82048) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:82050) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (368.270916ms)
(node:81992) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (43.713541ms)
✔ sessions start from public runs returned by recordRun and getRun (10.419083ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (10.108208ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (3.25925ms)
(node:82003) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (60.531208ms)
ℹ tests 28
ℹ suites 0
ℹ pass 28
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10500.852542

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/session.js && node --check src/planning.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-memory.js && node --check bin/nostr-research-console.js

(node:82279) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.