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
id: 023-bounded-reply-contexts
status: in_progress
max_attempts: 5
validation: workflow/tasks/023-bounded-reply-contexts.validate.sh
depends_on: 022-bounded-authored-note-expansion
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded reply-context resolution

## Reason

The subjective account-behavior trial could sample an account's authored
notes, but understanding its replies required comparing each reply with the
note it answered. Recreating that correctly in exploratory JavaScript would
duplicate NIP-10 interpretation, parent acquisition, shared budgets,
deduplication, provenance, partial failures, and unresolved-reference
handling.

Interpretation must remain in JavaScript. The library should resolve evidence,
not decide whether a reply is relevant, annoying, automated, or valuable.

## Objective

Add one exported, composable library operation and a thin persistent-console
wrapper that resolve a bounded set of authored replies together with their
direct parent notes.

An intended usage is:

```js
const contexts = await research.replyContexts(accounts, {
  relays,
  authoredLimit: 20,
  parentLimit: 20,
  timeoutMs: 12_000,
  eventLimit: 60,
  concurrency: 3
})
```

The exact result representation may follow the project's established
collection conventions, but JavaScript callers must be able to associate each
reply with its resolved parent or an explicit unresolved-parent result, and
inspect reasons and relay provenance for both.

## Semantics

- Inputs are explicit account subjects or an existing collection containing
  explicit account subjects.
- Acquire at most `authoredLimit` recent kind-1 notes per starting account.
- Only notes interpreted as replies under the library's existing NIP-10 rules
  become contexts.
- Resolve the direct reply parent, not an arbitrary mentioned event or merely
  the thread root.
- Acquire no more than `parentLimit` distinct missing parents.
- Authored-note and parent acquisition share the operation-wide timeout and
  event/observation budget.
- Deduplicate accounts, replies, and parent requests.
- A missing or unavailable parent remains explicit and does not discard the
  reply.
- Returned evidence retains ordinary event records, relationship
  interpretation, observations, and relay provenance.
- Report all bounds, request outcomes, counts, partial failures, and unresolved
  parents.
- Do not mutate the temporary research session selection.

Reject invalid bounds, unsupported inputs, and unusable relay options before
networking.

## Boundaries

- No relevance, tone, annoyance, automation, or semantic-similarity scoring.
- No generic conversation crawler or exhaustive thread reconstruction.
- No automatic recursion from parent notes.
- No pagination framework, UI, query DSL, or assessment model.
- Do not add general grouping/projection helpers solely for this operation.
- Keep the console surface a thin wrapper over the exported library operation.

## Verification

Use one public functional scenario with real SQLite and local NIP-01 WebSocket
relays proving:

- explicit accounts yield only their bounded authored replies;
- marked NIP-10 parents are preferred correctly over roots and mentions;
- legacy positional NIP-10 fallback follows the library's existing semantics;
- already-stored and newly acquired parents both resolve;
- unavailable parents are explicit;
- duplicate parent references generate one bounded request;
- per-account, parent, timeout, and global event budgets are enforced;
- reasons, provenance, partial relay failures, and session independence
  survive; and
- results remain usable as ordinary JavaScript data for caller-defined
  comparisons.

Do not create unit tests for presentation details or trivial helpers. Run the
complete suite and syntax checks.

## Acceptance criteria

- A caller can obtain a bounded reply-plus-parent corpus from explicit account
  selections without manually implementing protocol acquisition.
- Every returned reply has either its direct parent evidence or an explicit
  unresolved-parent state.
- Operation reports are bounded and explainable.
- No interpretation policy is encoded.
- Existing acquisition, expansion, session, and console behavior remain
  usable.


# Worker report

Implemented bounded reply-context resolution.

Deliverables changed:

- Added exported `resolveReplyContexts()` operation.
- Added thin `research.replyContexts()` console wrapper.
- Added shared authored/parent timeout and observation budgets.
- Added NIP-10 parent resolution, deduplication, provenance, request reports, and explicit unresolved states.
- Added functional coverage and input validation scenarios.
- Updated syntax checks and README documentation.

Validation:

- Task validation script passed.
- 20 tests passed.
- 9 relay tests skipped because this sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainty:

- Local WebSocket relay scenarios could not execute in this sandbox; they remain available for validation where loopback listeners are permitted.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:87647) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87647) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (306.278ms)
✔ global limit and cancellation are distinguishable and close owned sockets (138.28325ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (237.633459ms)
✔ timeout and partial connection failure remain observable (176.181667ms)
✔ acquisition rejects unusable public inputs before networking (8.646541ms)
✔ console expansion rejects invalid bounds and semantics before networking (7.1655ms)
Expanding through 2 relay(s), depth 2, event limit 10, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 observation(s), 7 workspace event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (184.548459ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (65.489541ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 observation(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (138.075875ms)
Expanding through 2 relay(s), depth 2, event limit 10...
Expansion completed: 6 request(s), 4 observation(s), 5 workspace event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (121.249416ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-workspace seeds (131.130541ms)
(node:87656) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87680) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87685) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87687) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87711) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87713) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87715) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87739) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87741) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87742) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87751) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87774) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87776) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87845) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (838.667125ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (48.867042ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (219.386875ms)
(node:87649) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (266.495ms)
(node:87650) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (64.775542ms)
(node:87651) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public console inspection and facets orient a bounded durable investigation (220.847833ms)
(node:87652) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (84.586792ms)
(node:87653) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (41.709166ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (41.79825ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (41.288083ms)
(node:87654) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1995.619542ms)
(node:87655) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (76.981375ms)
(node:87681) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87686) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87710) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87712) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87714) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87738) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:87740) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (405.335458ms)
(node:87682) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (50.990042ms)
✔ sessions start from public runs returned by recordRun and getRun (13.088292ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (12.953041ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (3.464875ms)
(node:87683) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (74.963667ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10546.071875

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/planning.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-memory.js && node --check bin/nostr-research-console.js

(node:88017) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.