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


# Worker report

Deliverables changed:

- Added an inspectable provisional-exclusions panel with Focus and Re-include actions.
- Projected excluded subjects through the public memory API.
- Added integration coverage for exclude/re-include.
- Replaced static shell inspection with a real Safari WebDriver smoke scenario covering the full controlled research loop.

Validation performed:

- Task validation script passed.
- `npm test` passed; localhost-dependent tests were skipped due sandbox EPERM.
- `npm run check`, test syntax checks, and `git diff --check` passed.

Unresolved uncertainty:

- Actual browser/runtime and responsive verification still requires an environment permitting localhost listeners and Safari automation.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research && node --test apps/research-playground/server.test.js


> @nostr-research/memory@0.1.0 test
> node --test

(node:79636) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79636) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (133.654ms)
✔ global limit and cancellation are distinguishable and close owned sockets (102.487208ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (179.506625ms)
✔ timeout and partial connection failure remain observable (155.461291ms)
✔ acquisition rejects unusable public inputs before networking (5.626791ms)
(node:79644) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79668) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79692) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79694) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79718) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79720) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79722) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79745) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79746) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79747) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79748) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79749) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79753) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79800) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (754.454084ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (52.644625ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (209.073792ms)
(node:79638) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (62.264208ms)
(node:79639) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (42.752042ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (26.875125ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (39.561208ms)
(node:79640) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (1990.721125ms)
(node:79641) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (52.423708ms)
(node:79642) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79667) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79669) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79693) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79695) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79719) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:79721) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (418.327ms)
(node:79643) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (55.088958ms)
✔ sessions start from public runs returned by recordRun and getRun (11.430125ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (12.721834ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (3.583125ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10323.266666
(node:79804) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ server adapter completes acquisition, focus, traversal, back, checkpoint, and reopen (55.634917ms)
﹣ browser completes the controlled research vertical slice (388.410333ms) # Safari WebDriver unavailable: Could not create a session: You must enable 'Allow remote automation' in the Developer section of Safari Settings to control Safari via WebDriver.
ℹ tests 2
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 0
ℹ duration_ms 510.510292

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research && node --check apps/research-playground/server.js && node --check apps/research-playground/app.js


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/session.js && node --check src/planning.js && node --check bin/nostr-research-memory.js



# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.