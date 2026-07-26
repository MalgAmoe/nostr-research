# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative within the
durable principles in `CONTEXT.md`. Historical completed tasks are evidence of
past work, not current policy.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.
Do not stage or commit changes; the runner owns the task commit after review.

If a previous review is supplied, address every applicable finding explicitly.
Do not implement a finding blindly when it conflicts with `CONTEXT.md`, expands
the selected task, or would add production complexity only to satisfy a test.
Explain that conflict in the worker report so the reviewer can assess it.
Do not merely describe work that should be done: perform the task within its
stated permissions.

## Verification discipline

Permanent tests are exceptional durable product code, not an automatic
deliverable for every feature or bug.

- Follow the testing policy in `CONTEXT.md`.
- Prefer a small public-boundary functional scenario over helper-level tests.
- Add a permanent test only when it protects stable, important behavior that is
  expensive or risky to verify otherwise.
- Do not test TCP, TLS, WebSocket-library mechanics, process scheduling,
  private state, private helpers, or exact timing unless that mechanism is
  explicitly the product behavior selected by the task.
- Use task validation or a run artifact for exploratory, live-network,
  environment-specific, and one-off verification.
- If a proposed test requires new public API, abstraction, dependency, or
  low-level production machinery, challenge the test before changing the
  product.
- Existing tests are not requirements by themselves. Remove or update a test
  when the selected product behavior intentionally changes.

When permanent tests are added or materially expanded, the final report must
name the stable public behavior each one protects and why temporary validation
was insufficient.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
- permanent tests added or expanded, with their justification, or `none`;
- unresolved uncertainties.


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
max_attempts: 6
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

## Reassessment after attempt 4

The first review after runtime evidence identified two new product defects:

1. scoped selection applied query limits to the full corpus before intersecting
   acquisition subjects, allowing unrelated corpus events to consume the
   bound and affect prefix ambiguity;
2. the concise acquisition envelope omitted bounded duplicate-observation
   counts and successful relay outcome/completeness summaries.

These findings were not repetitions of the earlier verification blocker.
Correct both at their existing plan/interpreter boundaries, add only the
smallest stable deterministic coverage warranted for scoped local selection
semantics, and rerun validation. The attempt limit was extended because the
diagnosis changed, not to retry an unchanged failure.


# Latest independent review

CHANGES_REQUIRED

1. Scoped selection applies the query and `limit` to the whole corpus before filtering to the acquisition buffer (`src/plan.js:202-225`). This can omit matching buffer subjects when unrelated corpus events consume the limit, and prefix resolution can become ambiguous because of out-of-scope events. Selection must be evaluated within the scoped subjects.

2. The default acquisition envelope does not explicitly report duplicate observations or successful relay-level completeness (`src/interpreter.js:479-541`). It only exposes accepted observations, distinct events, and unsuccessful relays. Add bounded duplicate and relay outcome/completeness summaries as required.