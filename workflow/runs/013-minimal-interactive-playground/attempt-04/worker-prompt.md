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

The product foundation is a UI-independent library. A CLI, functional
verification, and future user interfaces are consumers of that library; a UI
does not define the domain boundary. The first Solid application was an
experiment and has been removed. Its retained lessons may inform future work,
but its controllers, browser persistence, scoring rules, and module layout are
not a target architecture.

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
- which future UI workflows, if any, should consume the library.

The removed experiment contained candidate behavior in these areas but did not
settle them. Its retained lessons are documented in
`docs/solid-experiment-lessons.md`; its IndexedDB/localStorage persistence,
Solid state, relay cache policy, and editorial scoring heuristics must not be
recreated by default.

## Playground boundaries

A session is the smallest UI-independent coordinator over memory operations.
Its selection, focus, exclusions, history, and temporary branches are
replaceable process state. A research set is the explicit durable checkpoint
of chosen subjects and reasons; a research run is a durable account of an
operation. Neither a session nor its branches are serialized as a whole.

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
id: 013-minimal-interactive-playground
status: in_progress
max_attempts: 5
validation: workflow/tasks/013-minimal-interactive-playground.validate.sh
depends_on: 012-research-sessions-and-coverage
protected_paths: docs/solid-experiment-lessons.md workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Build the first minimal interactive research playground

## Objective

Create a new local application over the library and session module. This is a
fresh vertical slice, not a restoration or redesign of the removed Solid
prototype.

The application should let a person conduct the observe, focus, expand, and
retain loop interactively while the library remains authoritative for
research behavior.

## Application shape

Create one small application under `apps/`. Choose the least complex
maintainable web stack already compatible with the repository. A lightweight
framework is acceptable, but do not introduce an application architecture
framework, global state library, or elaborate design system.

Provide one root command that starts the local application. Keep the runtime
local and document its address and data location.

The application may use a small local server to own SQLite and relay
connections. Browser code must not open or mutate SQLite directly.

## Required vertical slice

The application must support:

1. create or open a research database;
2. start a temporary research session;
3. configure explicit relays, time bounds, kinds, and event budget;
4. start one bounded acquisition and see per-relay progress/outcomes;
5. inspect the resulting selection as readable notes or accounts;
6. focus an event or account without losing the selection;
7. include or exclude subjects provisionally;
8. traverse one explicit relationship type and make the result the current
   selection or a branch;
9. go back to the prior meaningful state; and
10. checkpoint the current selection as a durable research set.

Opening a saved research set in a new session must also work.

## Interaction principles

- The current selection is always identifiable.
- The researcher can see whether data is local or newly acquired.
- Every expansion shows the relationship and direction used.
- Partial relay completion, limits, timeouts, and missing evidence are visible.
- Back restores research state, not merely browser history.
- Inspecting a subject never silently replaces typed acquisition parameters.
- Empty results remain meaningful and do not clear the previous state without
  an explicit action.
- Loading indicators appear only around the operation that is actually
  waiting.

## Presentation

Render:

- profile names and identifiers;
- note text with line breaks and links;
- images, video, and audio from explicit content/tag URLs;
- timestamps and event kinds;
- relay provenance summaries; and
- an expandable raw-event/tags/protocol-evidence view.

Use a simple research-tool visual language. Do not spend this milestone on
branding, animation, dashboards, graph canvases, or a complete settings area.
The layout must remain usable in a narrow window.

## Library ownership

The application is an Adapter over public library/session operations.

- Do not reimplement Nostr filter semantics, relationship interpretation,
  set persistence, coverage, or result transformations in UI state.
- Application state may own dialogs, active tab, scroll position, and draft
  form values.
- Research state belongs to the session module.

If a required interaction reveals a missing public operation, add the smallest
library change and verify it at the library seam.

## Scope boundaries

- No login, signing, publishing, private messages, notifications, or global
  feed.
- No automatic discovery score, recommendations, moderation engine, or relay
  ranking.
- No recreation of Relay Pulse, investigation steps, query compiler, or the
  old application layout.
- No permanent session compatibility promise.
- No end-to-end test for every button.

## Verification

Keep permanent tests small:

- server/library integration for one complete vertical slice;
- one browser-level smoke scenario covering acquisition with a controlled
  source or fixture, selection, focus, traversal, back, and checkpoint; and
- responsive/manual verification recorded by the reviewer.

The independent reviewer must start the application, use it through an actual
browser, and confirm that research actions use the public library/session
behavior.

## Acceptance criteria

- One documented command starts a working local application.
- A new user can complete the required vertical slice without editing files or
  invoking the CLI.
- Research state survives navigation within the session.
- A checkpoint is reopenable as a new session.
- No removed prototype code or architecture is restored.
- The application remains small enough to understand as one vertical slice.


# Latest independent review

CHANGES_REQUIRED

1. `apps/research-playground/server.test.js` does not provide the required browser-level smoke scenario. It only fetches HTML/JavaScript and searches for control IDs and strings; it never drives an actual browser through acquisition, selection, focus, traversal, back, and checkpoint. Add the specified browser-driven smoke scenario using a controlled acquisition source.

2. `apps/research-playground/app.js` does not provide a meaningful provisional include workflow. “Include” is available only on subjects already in the current selection, while excluded subjects immediately disappear and cannot be re-included except by undoing state with Back. Provide a UI path to inspect provisional exclusions and re-include an excluded subject through `session.include`.

3. Mandatory independent runtime and responsive verification could not be completed because this reviewer environment rejects the documented listener with `listen EPERM 127.0.0.1:4317`. After the above changes, validation must be performed in an environment permitting localhost listeners and actual browser access.