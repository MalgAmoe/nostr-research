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
| **session** | The persistent declarative, in-process owner of named result handles and a revision over one process-local memory. |
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

Memory is the only authoritative corpus. A session is the persistent
declarative research session: it owns named result handles and a revision over
one process-local memory. Commands name their inputs and outputs explicitly;
there is no active or current selection. A result collection is the shared
operation result passed between the library and session layers. Retained
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
id: 046-authoritative-operation-and-collection-kinds
status: in_progress
max_attempts: 5
validation: workflow/tasks/046-authoritative-operation-and-collection-kinds.validate.sh
depends_on: 045-remove-superseded-research-interfaces
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make operation semantics and collection kinds authoritative

## Objective

Remove the duplicated operation/type knowledge that caused live continuation
results to contain events or accounts while their handles remained generic
`subjects`.

Validation, execution, schema discovery, plans, and the declarative session
must consume one authoritative description of each research operation rather
than reconstructing its input/output behavior independently.

## Work

- Inventory duplicated operation lists, input-kind rules, output-kind rules,
  local/external classification, and relationship output semantics across
  memory, plans, continuation, and the interpreter.
- Concentrate that knowledge in one existing deep operation module or one
  clearly justified deep replacement; do not create a collection of shallow
  per-command modules.
- Give every continuation relationship its narrowest honest output kind:
  - account-producing relationships return `accounts`;
  - event-producing relationships return `events`;
  - only genuinely heterogeneous expansion returns `subjects`.
- Make exact `subject.type` filtering refine a generic collection to `events`
  or `accounts`; preserve generic type for predicates that cannot prove a
  homogeneous result.
- Ensure runtime collection values, preflight descriptors, handles, plans,
  templates, and schema discovery agree.
- Apply the deletion test to standalone `expansion.js` and
  `reply-contexts.js`. Move any uniquely useful protocol behavior behind
  continuation, then delete interfaces and tests that no longer earn their
  complexity. Do not preserve historical exports.
- Remove duplicated validation and result-kind switches made obsolete by the
  authoritative operation semantics.

## Required live path

The following must work without manual ID extraction:

```text
account
  -> authored-notes
  -> filter subject.type=event
  -> referencedAccounts
  -> hydrate
```

And:

```text
account
  -> followed-accounts
  -> hydrate
```

## Acceptance criteria

- No known homogeneous continuation is exposed as generic `subjects`.
- Exact subject-type filtering performs safe type refinement.
- The required paths preflight and execute through both plans and the
  persistent declarative session.
- Schema discovery reports the same kinds and routes that execution accepts.
- Operation/type knowledge is materially less duplicated.
- Superseded expansion/reply interfaces are removed unless the reviewer
  identifies specific behavior that cannot yet be expressed through the
  current research model.

## Verification

- Permanent tests expected: yes, extend one public continuation workflow to
  protect the two required paths and type refinement; retain focused protocol
  tests only for unique Nostr relationship rules.
- Stable public behavior protected: preflight/runtime kind agreement and
  composable typed navigation.
- Temporary task validation or field evidence: replay the exact live failure
  with deterministic evidence and inspect schema output.
- Explicitly excluded test levels or mechanisms: tests per relationship,
  private registry/helper tests, relay-network, socket, and UI tests.


# Latest independent review

CHANGES_REQUIRED

1. `continuation.functional.test.js` does not execute the complete first required path through either consumer. The session path stops after `referencedAccounts`, while the plan uses `select -> expansion -> filter -> referencedAccounts` and also stops before `hydrate`. Extend the public workflow so both the declarative session and a plan execute and preflight the exact route `account -> authored-notes -> filter subject.type=event -> referencedAccounts -> hydrate`, asserting kind agreement at each stage.