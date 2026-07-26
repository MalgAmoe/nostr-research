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

- Memory is one capacity-bounded, process-local corpus shared by the library,
  CLI, functional verification, and future applications.
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
- Persistence and a database format are deliberately absent. Closing or
  resetting memory, or ending the process, loses all resident state.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The bounded process-local research corpus of evidence, observations, and replaceable derived material. |
| **session** | A temporary, in-process research playground coordinating selection, focus, provisional exclusions, branches, and meaningful actions over memory. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **focus** | An optional subject receiving attention in a session; it is independent of and does not rewrite the selection. |
| **temporary branch** | A session-local named snapshot of selection, focus, and exclusions used to revisit an exploratory path; it is not durable evidence. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | A process-local record of one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One process-local recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it; unlike a session, it is an immutable operation snapshot. |
| **research set** | A deliberately retained, named group of subjects for later inspection or expansion during the running process. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with the real process-local corpus.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, ranking method,
or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- provenance detail and process-local research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the only authoritative corpus. A session coordinates selection, focus,
exclusions, history, and temporary branches over memory operations. A result
collection is the shared operation result passed between these layers. A research
set is a process-local checkpoint; a research run is a process-local account of an
operation. Retained groups, runs, and coverage disappear with the corpus. Sessions
and branches are not serialized.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
records bounded acquisition coverage. Coverage says that a precise
relay/filter/budget attempt occurred. It never says that the relay or time
window was exhaustively indexed.

Removing the remaining Node dependencies is a separate future milestone.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.

Acquisition exposes separate operation-wide bounds for accepted valid relay
observations and distinct canonical event IDs. Duplicate observations consume
the observation budget but not the distinct-event budget. Reports keep
received packets, accepted observations, duplicate observations, newly stored
corpus events, and distinct events acquired separate, and identify which bound
stopped an operation.


# Selected task

---
id: 027-explicit-acquisition-budgets
status: in_progress
max_attempts: 5
validation: workflow/tasks/027-explicit-acquisition-budgets.validate.sh
depends_on: 026-remove-sqlite
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make acquisition budgets explicit and semantically correct

## Objective

Correct the mismatch between relay observations and distinct Nostr events.
Acquisition and expansion must expose separate, plainly named bounds so callers
can control relay work without mistaking duplicate observations for new events.

## Required behavior

- Replace the misleading public `eventLimit` option with explicit observation
  and distinct-event budgets. There is no compatibility requirement for the old
  name.
- The observation budget is a hard operation-wide bound on accepted valid
  `EVENT` messages across all relays.
- The distinct-event budget is a hard operation-wide bound on unique canonical
  event IDs acquired by the operation.
- Completion and reports identify which bound stopped the operation.
- Counts and budget reports consistently distinguish received packets, accepted
  observations, duplicate observations, newly stored corpus events, and
  distinct events acquired by the operation.
- Authored-note limits count distinct authored event IDs per starting account,
  not observations returned by multiple relays.
- Expansion and reply-context resolution propagate the new budget vocabulary
  and never silently reinterpret one kind of limit as another.
- Console progress and presentation use the same terminology.

The implementation must remain bounded under duplicate-heavy relay responses.
It is acceptable for an observation bound to stop an operation before its
distinct-event target is reached; that uncertainty must be visible rather than
hidden.

## Boundaries

- Do not add adaptive relay heuristics, retries, persistence, or quality rules.
- Do not encode assumptions about which relay is authoritative.
- Do not redesign the corpus, sessions, retained selections, or presentation
  architecture in this task.
- Avoid unit tests for option plumbing. Exercise the public acquisition and
  expansion boundaries with duplicate relay observations.

## Documentation

Update active README and canonical context where they describe acquisition
budgets. Historical task definitions and field-trial artifacts remain
historical records.

## Acceptance criteria

- No active public option or active documentation calls an observation bound
  `eventLimit`.
- Direct acquisition enforces and reports both bounds.
- Duplicate observations do not consume the distinct-event budget.
- Authored-note expansion limits distinct notes per account.
- Acquisition, expansion, and reply-context reports use coherent counts.
- Existing cancellation, timeout, relay outcome, provenance, and corpus
  capacity behavior remains intact.
- Functional tests and syntax checks pass.


# Worker report

Implemented explicit acquisition budgets throughout the library:

- Added `observationLimit` and `distinctEventLimit`.
- Added separate packet, observation, duplicate, corpus-storage, and distinct-event counts.
- Propagated budgets through expansion, authored-note acquisition, and reply-context resolution.
- Updated completion reasons, console progress, presentation output, coverage/run validation, README, and canonical context.
- Added duplicate-heavy functional coverage and updated existing fixtures.

Validation:

- Task validation script passed.
- Syntax checks passed.
- 16 tests passed; 10 relay tests skipped because the sandbox forbids loopback listeners.
- `git diff --check` passed.
- No staging or commits performed.
- Existing workflow task/run changes were left untouched.

Unresolved uncertainty: loopback-dependent relay tests could not execute in this sandbox.

# Validation output

Exit code: 1


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-console.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:29273) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (131.033334ms)
✔ global limit and cancellation are distinguishable and close owned sockets (115.604291ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (109.753125ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (155.010667ms)
✔ timeout and partial connection failure remain observable (141.893875ms)
✔ acquisition rejects unusable public inputs before networking (0.453208ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.674375ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (158.383084ms)
✖ authored-note expansion obeys the complete operation budget and stays disabled by default (50.213541ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (114.225708ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (50.718083ms)
✖ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (101.862917ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (345.277625ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (38.984916ms)
✔ process-local memory preserves canonical evidence and independent relay observations (36.100125ms)
✔ public console inspection and facets orient a bounded process-local investigation (201.641917ms)
✔ replaceable selection and follow interpretation remain stable in one process (68.353917ms)
✔ public local search composes constraints, explains matches, and preserves provenance (29.989ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (32.812ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (53.520917ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2444.1215ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (38.998375ms)
✔ recorded query becomes an explainable, expandable, combinable process-local research path (48.75975ms)
✔ public session actions remain temporary while checkpoints remain process-local (36.695834ms)
✔ sessions start from public runs returned by recordRun and getRun (5.177625ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (3.117875ms)
ℹ tests 26
ℹ suites 0
ℹ pass 24
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10344.550167

✖ failing tests:

test at test/acquisition.functional.test.js:481:1
✖ authored-note expansion obeys the complete operation budget and stays disabled by default (50.213541ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
    [
      2,
  +   2
  -   1
    ]
  
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:522:12)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: [ 2, 2 ],
    expected: [ 2, 1 ],
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at test/acquisition.functional.test.js:874:1
✖ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (101.862917ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(receivedFilters.some((filter) => (
  
      at TestContext.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/acquisition.functional.test.js:923:12)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
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