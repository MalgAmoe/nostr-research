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


# Worker report

Implemented task 046.

Deliverables changed:
- Added authoritative operation, relationship, collection-kind, route, and locality registry.
- Unified plan, session, schema, runtime, template, and preflight semantics.
- Added exact `subject.type` refinement to `events` or `accounts`.
- Assigned narrow continuation output kinds.
- Removed standalone expansion/reply-context APIs, implementations, docs, presentation logic, and obsolete tests.
- Extended the public continuation workflow for typed navigation and hydration composition.

Validation:
- `git diff --check`
- Task validation script
- Full test suite: 22 passed, 9 relay tests skipped because the sandbox forbids loopback listeners.

Permanent tests expanded:
- Public continuation workflow now protects preflight/runtime kind agreement, exact type refinement, both required navigation routes, plan/session composition, hydration compatibility, and schema agreement. Temporary validation alone would not protect this stable cross-layer contract.

Unresolved uncertainties:
- None. Network-specific tests remain intentionally skipped in this sandbox.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/operations.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:52539) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (114.83475ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, and provenance (101.254042ms)
✔ account hydration derives a bounded metadata filter from account subjects (88.224667ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (139.689334ms)
✔ plan preflight rejects retention of value collections before acquisition starts (72.983667ms)
✔ global limit and cancellation are distinguishable (174.090042ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (104.534833ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (65.558667ms)
✔ timeout and partial connection failure remain observable (155.150375ms)
✔ acquisition rejects unusable public inputs before networking (0.4505ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (39.943666ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.351083ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (10.895084ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.66325ms)
✔ stable bounds and compatible set composition share the public pipeline algebra (11.283375ms)
✔ pipeline schema exposes literal fields and preflight rejects invalid composition (4.080917ms)
✔ bounded groups preserve complete derived inputs and provenance for aggregation (8.322ms)
✔ named account and note handles continue with bounded relationship provenance (2354.772375ms)
✔ declarative observation and lifecycle form one bounded public workflow (42.342292ms)
✔ declarative show bounds grouped and summarized named results (3.743417ms)
✔ declarative named results compose compatible sets and expose their schema (4.839166ms)
✔ declarative judgments and retained selections survive explicit workspace lifecycle (11.199125ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (22.310375ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (23.950083ms)
✔ JSONL executable provides one persistent bounded process workflow (91.628958ms)
✔ process-local memory preserves canonical evidence and independent relay observations (37.825625ms)
✔ replaceable selection and follow interpretation remain stable in one process (55.866959ms)
✔ public local search composes constraints, explains matches, and preserves provenance (38.186791ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (24.174958ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2378.429084ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (24.193792ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2589.183166


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.