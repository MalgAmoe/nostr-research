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
id: 043-judgment-and-session-ergonomics
status: in_progress
max_attempts: 4
validation: workflow/tasks/043-judgment-and-session-ergonomics.validate.sh
depends_on: 042-bounded-research-views
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add explicit judgment and complete the research session lifecycle

## Objective

Let a researcher carry provisional judgment through a session and manage the
resulting workspace without hidden rules or arbitrary JavaScript.

## Work

- Support explicit subject or result annotations such as interested,
  uninterested, uncertain, and anchor.
- Allow optional strength and a caller-authored reason.
- Make annotations usable as ordinary positive or negative pipeline
  constraints while keeping them visibly provisional and process-local.
- Preserve positive and negative examples as evidence; do not train or infer
  automatic classifications.
- Complete handle and retained-set lifecycle:
  - warn before retaining an empty result;
  - list, inspect, rename, replace, delete, and bulk-release;
  - distinguish releasing a handle from deleting a retained set;
  - prevent accidental silent replacement unless explicitly requested.
- Add concise session/schema discovery, clear input-type errors, and literal
  account field documentation.
- Provide a small set of declarative templates only where they expand to the
  same normalized operations and remain inspectable.

Remove or simplify obsolete session surface revealed by this work. Do not
retain compatibility code for unused experimental behavior.

## Milestone field trial

Repeat several earlier open-ended research tasks through the JSONL session,
including:

- finding a coherent group of accounts from a noisy acquisition;
- pursuing one account into authored notes and conversation context;
- expressing both positive and negative interest;
- changing direction and releasing intermediate state.

Use no dynamically authored JavaScript for research operations. Record exact
friction and any still-missing neutral operation in:

`workflow/artifacts/composable-session-field-trial.md`

The trial must judge whether the declarative session now provides the
practical exploratory capability previously supplied by JavaScript. It must
not claim success merely because commands execute.

## Acceptance criteria

- Judgments are explicit, explainable, process-local, and composable.
- Handle and retained-set lifecycle is complete and unambiguous.
- Operation/field discovery is sufficient to use the session without source
  inspection.
- The milestone trial performs genuine iterative navigation without dynamic
  JavaScript.
- The artifact identifies what belongs in the library, what remains human
  judgment, and whether the JavaScript REPL can now be deprecated.
- Obsolete or redundant session code encountered by the task is removed.

## Verification

- Permanent tests expected: yes, one public session-lifecycle functional
  scenario may protect annotation and retained-set semantics.
- Stable public behavior protected: explicit judgments, lifecycle distinction,
  normalized template expansion, response envelopes.
- Temporary task validation or field evidence: the milestone field trial and
  bounded live transcript.
- Explicitly excluded test levels or mechanisms: one test per command,
  inferred-quality tests, network transport tests, UI tests, compatibility
  tests for unused experiments.


# Previous independent review

CHANGES_REQUIRED

1. The required validation fails. In `src/interpreter.js:345`, empty-result handling occurs before validating retained-operation fields, so the unsupported `callback` parameter returns `EMPTY_RESULT` instead of `INVALID_OPERATION`, breaking the existing public functional scenario at `test/acquisition.functional.test.js:196`. Validate retain parameters before applying the empty-retention guard, preserving clear input errors and making `npm test` and the task validation script pass.

# Worker report

Implemented the review fix.

- Changed retain handling so parameter/schema validation occurs before the empty-result guard.
- Unsupported fields now consistently return `INVALID_OPERATION`; valid empty retention still returns `EMPTY_RESULT` unless `allowEmpty: true`.
- Expanded the public session-lifecycle functional scenario to protect this error precedence.

Validation:

- Task validation script: passed.
- Full test suite: 27 passed, 15 skipped because loopback listeners are unavailable.
- Syntax checks and `git diff --check`: passed.
- Debug instrumentation: none.

Permanent test expanded: the existing lifecycle scenario now protects stable public retain validation and response-envelope semantics. Temporary validation alone was insufficient because the prior acquisition scenario depended on loopback availability.

Unresolved uncertainties: live relay/loopback scenarios remain unexecuted in this sandbox. No files were staged or committed.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check src/jsonl-session.js && node --check bin/nostr-research-console.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:42687) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (178.237458ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, and provenance (73.677792ms)
✔ account hydration derives a bounded metadata filter from account subjects (104.456417ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (125.377792ms)
✔ plan preflight rejects retention of value collections before acquisition starts (15.382333ms)
✔ global limit and cancellation are distinguishable (71.780292ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (78.708667ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (47.890458ms)
✔ timeout and partial connection failure remain observable (134.838459ms)
✔ acquisition rejects unusable public inputs before networking (0.422292ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.483042ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (136.927375ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (57.551375ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (165.351875ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (113.108125ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (198.487ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (128.017417ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (46.516791ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.60875ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (17.323792ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.668625ms)
✔ stable bounds and compatible set composition share the public pipeline algebra (15.672625ms)
✔ pipeline schema exposes literal fields and preflight rejects invalid composition (5.682375ms)
✔ bounded groups preserve complete derived inputs and provenance for aggregation (11.652542ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (306.725875ms)
✔ named account and note handles continue with bounded relationship provenance (2253.314ms)
✔ declarative observation and lifecycle form one bounded public workflow (39.091667ms)
✔ declarative show bounds grouped and summarized named results (8.63275ms)
✔ declarative named results compose compatible sets and expose their schema (3.831834ms)
✔ declarative judgments and retained selections survive explicit workspace lifecycle (6.082292ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (29.965709ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (29.084167ms)
✔ JSONL executable provides one persistent bounded process workflow (94.010834ms)
✔ process-local memory preserves canonical evidence and independent relay observations (25.325958ms)
✔ presentation and facets orient surviving research values (52.066833ms)
✔ replaceable selection and follow interpretation remain stable in one process (49.478792ms)
✔ public local search composes constraints, explains matches, and preserves provenance (43.340875ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (24.079291ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2296.965833ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (32.387375ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (39.074833ms)
✔ retained reactivation does not recreate evicted canonical evidence (6.129792ms)
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2524.985834


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.