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

Treat the durable principles in `CONTEXT.md` as constraints on every task.
Historical completed tasks do not override current policy. Do not invent
stronger acceptance criteria than the selected task defines.

Audit test changes as carefully as production changes:

- Permanent tests are exceptional and must protect stable public behavior.
- Reject unnecessary tests, helper-level tests, and tests that freeze private
  implementation or third-party runtime mechanics.
- Reject tests of TCP, TLS, WebSocket-library behavior, process scheduling, or
  exact timing unless the selected task explicitly makes that mechanism a
  product responsibility.
- Reject production APIs, abstractions, dependencies, or low-level machinery
  introduced only to satisfy a test.
- Accept temporary validation or run artifacts for live-network,
  environment-specific, exploratory, and one-off evidence.
- Passing validation is not evidence that every test is worth keeping.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish or expand the task.

Use `BLOCKED` when completion requires a human decision or unavailable external
information. Also use it when the same substantive finding from the supplied
previous review remains after another worker attempt: stop for reassessment
instead of requesting a third mechanical implementation.


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
| **session** | The temporary, in-process owner of the console's explicitly activated selection and its last meaningful state action. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **retained selection** | A deliberately retained, named result collection with its subjects and reasons for later inspection during the running process. |
| **annotation** | A process-local interpretation attached to a stable subject: caller-defined labels and a free-text note. It is navigation state, not source evidence or a universal claim. |
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
- provenance detail and retained-selection semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Process-local boundaries

Memory is the only authoritative corpus. A session owns only the console's
explicitly activated selection and its last state action. All query,
acquisition, expansion, reply-context, filtering, facet, comparison,
inspection, and traversal operations return values without changing that
selection. Activation is a separate explicit operation. Retaining a supplied
result and checkpointing the active selection are distinct operations. A result
collection is the shared operation result passed between these layers. Retained
selections disappear with the corpus; sessions are not serialized.

Local selection asks what the current resident memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
returns bounded acquisition coverage directly to the caller. Coverage says
that a precise relay/filter/budget attempt occurred. It is not registered as
global history and never says that the relay or time window was exhaustively
indexed.

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

Canonical validation alone does not establish that relay evidence belongs to
the requested slice. Acquisition matches each canonical event against the
exact normalized NIP-01 filter before ingestion or budget accounting and
reports canonical non-matches separately. For composed expansion and
reply-context operations, the distinct-event bound is shared across nested
requests, so a repeated ID consumes distinct capacity only on its first
appearance.

Explicit session activation accepts both retained summaries and full retained
selections through the same retained-to-collection conversion. It restores
subjects and retained reasons without relay access or reconstruction of
evicted canonical evidence.

Annotations belong to memory's replaceable derived material. They can outlive
eviction of the canonical event or profile they reference, but disappear with
`reset()`, `close()`, or process exit. Annotation labels have only the meaning
assigned by their caller.


# Selected task

---
id: 039-scoped-working-buffers
status: in_progress
max_attempts: 4
validation: workflow/tasks/039-scoped-working-buffers.validate.sh
depends_on: 038-jsonl-session-field-trial
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make acquisition produce bounded scoped working buffers

## Objective

Make each acquisition usable as a bounded research starting point instead of
only adding evidence to the global resident corpus.

An acquisition result must identify the exact subjects produced by that
acquisition. Later local operations must be able to explicitly choose either
that scoped buffer or the whole resident corpus.

## Work

- Represent acquisition output as an engine-owned named result using the same
  stable subject identity and current-evidence resolution as other handles.
- Keep the resident corpus canonical and shared; do not copy full records into
  command state.
- Make the default acquisition response concise:
  - requested and observed bounds;
  - distinct subjects added or refreshed;
  - duplicates and relay-level completeness;
  - corpus size, capacity pressure, and eviction effects;
  - a bounded representative preview and bounded useful facets.
- Keep detailed per-event and per-relay diagnostics available through an
  explicit bounded projection rather than returning them by default.
- Make result scope visible in summaries and errors so a caller can tell
  acquisition slice from whole-corpus query.
- Support an ergonomic replace/advance operation for a designated working
  handle without deleting its subjects from the corpus.

Do not add persistence, UI state, automatic relevance rules, or a second
memory model.

## Acceptance criteria

- A session can acquire into a named scoped buffer and subsequently select
  only from that buffer.
- Whole-corpus selection remains possible only when explicitly requested.
- Default acquisition output is bounded and does not enumerate every observed
  event.
- Detailed coverage remains inspectable on demand.
- Replacing a working handle has explicit lifecycle semantics and does not
  mutate canonical evidence.
- Existing plan and JSONL adapters use the same normalized operations.

## Verification

- Permanent tests expected: no new acquisition test. Existing public
  functional scenarios may be adapted where the changed explicit scope is
  already exercised.
- Stable public behavior protected: scoped versus corpus selection, handle
  lifecycle, bounded response envelope.
- Temporary task validation or field evidence: a bounded loopback or live
  acquisition through the real public session command, demonstrating the
  complete named-acquisition -> scoped-selection -> concise-default ->
  opt-in-coverage -> non-destructive-replacement workflow.
- Explicitly excluded test levels or mechanisms: relay-network tests,
  WebSocket/TCP/TLS behavior, private helper unit tests, UI tests.

## Reassessment after attempt 2

The original verification wording allowed a permanent deterministic
session-boundary scenario while also excluding relay-network tests. Those
requirements conflict for the public `acquire` command, which necessarily owns
relay I/O. Do not add a production acquisition-injection seam merely to make
this test deterministic.

Remove the fabricated acquisition report and direct internal presentation
assertions introduced during attempts 1-2. Verify the complete public command
chain as temporary loopback/live task evidence instead. This is a changed
verification premise, not a request to mechanically repeat the previous test
approach.

The worker sandbox could not bind the required listener. The primary agent
therefore performed this temporary verification from the outer execution
environment and recorded the result in:

`workflow/runs/039-scoped-working-buffers/manual-public-command-evidence.md`

Review this evidence instead of requesting a production test seam or another
permanent relay-network test.


# Previous independent review

BLOCKED

The required temporary public-command evidence is unavailable. Validation passes the permanent suite, but does not demonstrate the complete named acquisition → scoped selection → concise default → opt-in coverage → non-destructive replacement workflow. The worker reports that loopback verification cannot run because this sandbox prohibits listeners. Since runtime verification is explicitly required and cannot be completed here, acceptance cannot be confirmed.

# Worker report

Implemented task 039’s scoped acquisition buffers.

Deliverables changed:

- Acquisition results are named, engine-owned scoped handles.
- `select` now requires explicit acquisition or whole-corpus scope.
- Default acquisition responses are bounded and concise.
- Detailed relay/event coverage is available through `show` with `mode: "coverage"`.
- Handle replacement uses explicit `replace: true` and preserves canonical corpus evidence.
- Plan, JSONL, documentation, and existing functional scenarios use the normalized scope contract.
- Required outer-environment public-command evidence is present at `workflow/runs/039-scoped-working-buffers/manual-public-command-evidence.md`.

Validation performed:

- `sh workflow/tasks/039-scoped-working-buffers.validate.sh`
- Syntax checks passed.
- Test suite passed: 21 passed, 0 failed, 15 loopback tests skipped by sandbox policy.
- CLI help smoke check passed.
- Temporary evidence demonstrates the complete named acquisition → scoped selection → concise response → opt-in coverage → non-destructive replacement workflow.

Permanent tests added or expanded:

- No new acquisition test.
- Existing public functional scenarios were adapted to protect explicit corpus/acquisition scope and handle metadata. Network-specific verification remains temporary evidence as required.

Unresolved uncertainties:

- None. The latest review blocker was the missing evidence; that evidence is now available.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check src/jsonl-session.js && node --check bin/nostr-research-console.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:16385) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (114.3725ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, and provenance (91.68525ms)
✔ account hydration derives a bounded metadata filter from account subjects (130.356ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (187.417541ms)
✔ plan preflight rejects retention of value collections before acquisition starts (18.392333ms)
✔ global limit and cancellation are distinguishable (97.50675ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (79.480291ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (100.39475ms)
✔ timeout and partial connection failure remain observable (155.295166ms)
✔ acquisition rejects unusable public inputs before networking (0.414792ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.484334ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (76.668708ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (50.719917ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (79.029542ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (152.915875ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (47.94025ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (126.312666ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (41.334208ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.899291ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (16.61175ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.638667ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (305.887917ms)
✔ declarative observation and lifecycle form one bounded public workflow (53.341292ms)
✔ declarative show bounds grouped and summarized named results (2.127208ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (35.584584ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (26.75525ms)
✔ JSONL executable provides one persistent bounded process workflow (95.635833ms)
✔ process-local memory preserves canonical evidence and independent relay observations (31.961209ms)
✔ presentation and facets orient surviving research values (38.495666ms)
✔ replaceable selection and follow interpretation remain stable in one process (52.775166ms)
✔ public local search composes constraints, explains matches, and preserves provenance (26.731959ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (19.192458ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2239.021125ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (29.906542ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (31.965959ms)
✔ retained reactivation does not recreate evicted canonical evidence (6.18075ms)
ℹ tests 36
ℹ suites 0
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2466.766875


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.