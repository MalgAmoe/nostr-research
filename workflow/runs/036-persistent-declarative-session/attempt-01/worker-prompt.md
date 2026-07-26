# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.
Do not stage or commit changes; the runner owns the task commit after review.

If a previous review is supplied, address every applicable finding explicitly.
Do not merely describe work that should be done: perform the task within its
stated permissions.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
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
id: 036-persistent-declarative-session
status: in_progress
max_attempts: 4
validation: workflow/tasks/036-persistent-declarative-session.validate.sh
depends_on: 035-plan-and-algebra-correctness
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Add the persistent declarative research session

## Objective

Create the in-process interpreter foundation which gives agents persistent,
named access to the existing declarative algebra without executing arbitrary
code.

This is not the JSONL adapter and not the observation/presentation task. It is
the reusable session and command protocol underneath those adapters.

## Shared operation execution

Deepen the current plan module so individual interpreter commands and named
plans use one normalized operation representation and one execution path.

- Extract or expose the smallest shared preflight/execution capability needed
  by both callers.
- Do not duplicate filter, group, summarize, move, acquisition, hydration, or
  retention semantics in the interpreter.
- Preserve complete preflight before external effects.
- Preserve existing valid named-plan behavior and reports.

## Interpreter-owned state

Add a focused module, preferably `src/interpreter.js`, which owns:

- one open bounded research memory supplied by its caller;
- engine-owned named result handles;
- a non-negative integer session revision;
- command validation and dispatch;
- active external-operation cancellation;
- close behavior.

Named result handles are not copied canonical datasets. Subject collections
remain stable subject/reason references whose evidence resolves through memory.
Typed group/summary results remain bounded engine-owned results.

A public handle reports only concise metadata:

```json
{"id":"authors","kind":"accounts","count":24,"revision":18}
```

Reject duplicate result IDs unless the command explicitly requests
replacement. Replacing or releasing a handle is interpreter-state mutation.

## Stable command envelope

Accept plain JSON commands containing:

- caller-owned non-empty `commandId`;
- optional non-negative `ifRevision`;
- `command`;
- command-specific plain-data fields.

Return exactly one plain-data response:

```json
{
  "ok": true,
  "commandId": "c17",
  "sessionRevision": 42,
  "result": {},
  "warnings": []
}
```

or:

```json
{
  "ok": false,
  "commandId": "c17",
  "sessionRevision": 42,
  "error": {
    "code": "UNKNOWN_RESULT",
    "message": "...",
    "details": {}
  }
}
```

Initial stable error codes:

- `INVALID_COMMAND`
- `INVALID_OPERATION`
- `UNKNOWN_RESULT`
- `DUPLICATE_RESULT`
- `INVALID_SUBJECT`
- `TYPE_MISMATCH`
- `REVISION_CONFLICT`
- `SESSION_CLOSED`
- `INTERNAL_ERROR`

Expected bounded relay/hydration incompleteness is not a command error.

## Initial research commands

Support the existing operation vocabulary:

- `acquire`
- `select`
- `filter`
- `group`
- `summarize`
- `move`
- `hydrate`
- `retain`
- complete named `plan`

Commands consuming results name their input handle. Result-producing commands
may supply a result ID. Plans expose selected stage outputs as handles without
changing plan-stage semantics.

## Revision invariant

- Successful commands increment revision once when they mutate corpus,
  retained memory state, or named handles.
- Read-only commands do not increment revision.
- A failed command leaves interpreter-owned state, memory, and revision
  unchanged.
- `ifRevision` conflicts fail before execution.
- An external operation which encountered bounded partial relay outcomes
  returns `ok: true` with structured completeness; it is not converted into an
  error.

Use preflight and the existing bounded external-operation reporting to uphold
the failed-command invariant. Do not create a corpus snapshot/rollback system.

## Boundaries

- No stdin/stdout, JSONL, browser adapter, UI, persistence, Rust, DSL, plugin,
  or automatic judgment.
- Do not add algebra operations.
- Do not merge this session with the JavaScript console's active-selection
  `ResearchSession`; they have different responsibilities.
- Do not expose arbitrary callbacks or executable strings.
- Add one public functional scenario covering command envelopes, handles,
  revision behavior, replacement, preflight failure, and partial external
  outcomes. Avoid per-command unit tests.

## Acceptance criteria

- Plans and interactive commands demonstrably share normalization/execution.
- Named handles persist across commands and do not duplicate canonical
  evidence ownership.
- Stable response envelopes and semantic error codes are returned.
- `ifRevision` and mutation-only revisions behave predictably.
- Failed commands leave memory, handles, and revision unchanged.
- Partial external outcomes are successful commands with structured status.
- No supplied executable code is accepted.
- Existing plan, algebra, console, and functional behavior remains intact.
- Functional tests and syntax checks pass.
