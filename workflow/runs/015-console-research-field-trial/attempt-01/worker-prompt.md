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
id: 015-console-research-field-trial
status: in_progress
max_attempts: 4
validation: workflow/tasks/015-console-research-field-trial.validate.sh
depends_on: 014-persistent-javascript-research-console
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Conduct a persistent-console research field trial

## Objective

Operate the JavaScript research console as an agent would during a real,
guided Nostr investigation. Validate the interaction model against actual
research work rather than treating process startup as sufficient.

This task may make small cohesive repairs to the console or public composition
surface when the field trial exposes a concrete blocker. It must not add
speculative discovery rules.

## Investigation

Use explicit, bounded public relay acquisition to find a small set of
potentially interesting accounts and connected discussions. Begin with broad
evidence, inspect what the data contains, then direct subsequent acquisition
or traversal from observed accounts, tags, replies, mentions, or follow
evidence.

The goal is not to assert a universal definition of "interesting." The goal is
to exercise the reusable path:

```text
acquire -> inspect -> select -> expand -> compare -> retain
```

Use at least two relays when available. Keep time ranges, concurrency,
timeouts, and event budgets explicit and polite. Record relay failures as
evidence; do not compensate with unbounded retries.

## Deliverable

Create `workflow/artifacts/first-console-field-trial.md` containing:

- exact runtime setup and bounded acquisition parameters;
- representative JavaScript commands submitted to the same console process;
- concise findings with event/account identifiers and provenance;
- which operations composed naturally;
- concrete friction or missing operations;
- any small repairs made and why they were necessary; and
- no more than five evidence-backed candidate next tasks.

Do not commit the disposable SQLite database.

## Permitted repairs

Repairs must be directly justified by a failed or awkward field-trial step and
remain within the library or console:

- fixing incorrect composition or result handling;
- making an existing result inspectable without flooding output;
- exposing a missing direct route to an already-supported library operation;
- correcting lifecycle, cancellation, or persistence behavior; or
- sharpening misleading documentation.

Do not add ranking, trust, spam, recommendation, clustering, background scans,
UI code, or general plugin systems.

## Verification

The permanent suite stays boundary-focused. Add a regression only when the
trial exposed an actual correctness defect not already covered by a public
scenario. Do not encode field-trial data or subjective account choices as
tests.

The reviewer must run the console through a persistent process, not translate
the commands into separate CLI invocations.

## Acceptance criteria

- One console process supports a multi-step adaptive investigation.
- Live acquisition is bounded, explicit, and provenance-preserving.
- Intermediate JavaScript values are reused in later operations.
- At least one meaningful result is retained and readable after reopening.
- The artifact distinguishes observed evidence from interpretation.
- Any code repair is small and directly tied to trial evidence.
- Recommendations arise from actual use rather than speculative architecture.
