# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
files. Do not repair the work.

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
does not define the domain boundary. The current Solid application is a
behavioral reference during this work. Its code and observed behavior may be
retained, recreated, or rejected deliberately; neither its Solid controllers,
browser persistence, nor its present module layout is an implicit target
architecture.

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
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it. |
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

The current application contains useful behavior in all of these areas, but it
does not settle them. In particular, its IndexedDB/localStorage persistence,
Solid state, hidden array metadata, relay cache policy, and editorial scoring
heuristics must not be copied into the library by default.


# Selected task

---
id: 005-live-relay-acquisition
status: in_progress
max_attempts: 5
validation: workflow/tasks/005-live-relay-acquisition.validate.sh
depends_on: 004-sqlite-memory-foundation
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Acquire real relay events into research memory

## Objective

Add one bounded, observable live-relay acquisition operation to the public
library and CLI. It must acquire real Nostr events from explicitly selected
relays and store them through the existing SQLite research-memory boundary.

This is acquisition, not search ranking or a research-session abstraction.

## Required public behavior

- Accept one or more explicit `wss://` relay URLs and one valid Nostr filter.
- Require a caller-controlled timeout and bounded total event count, with
  documented conservative defaults when omitted.
- Use bounded relay concurrency and allow an in-flight operation to be
  cancelled through the public library boundary.
- Handle NIP-01 `EVENT`, `EOSE`, `CLOSED`, connection failure, and timeout
  outcomes without treating them as equivalent.
- Validate every received event before persistence.
- Store valid canonical events through the existing memory implementation.
- Retain relay and observation-time provenance for every accepted observation.
- Deduplicate canonical events while retaining observations from distinct
  relays.
- Stop cleanly when the total limit, timeout, cancellation, or relay completion
  condition is reached.
- Close subscriptions and sockets owned by the operation.

Return a structured acquisition result containing:

- requested filter and relays;
- operation start and finish times;
- completion reason;
- acquired event IDs;
- per-relay outcome and useful diagnostics;
- received, invalid, duplicate, newly stored, and observation counts.

Counts and terms must be defined precisely enough that callers do not need to
infer their meaning from implementation details.

## CLI behavior

Add an `acquire` command to the existing CLI. It must support:

- repeated explicit `--relay` arguments;
- a Nostr filter supplied as JSON text or an explicitly named JSON file;
- database path, timeout, and total-event limit;
- machine-readable structured output;
- useful non-zero failures for malformed filters, invalid relay URLs, and
  unusable arguments.

Do not add a hidden default relay list. The caller must know which relays are
being contacted.

## Scope boundaries

- Do not add local text search, relationship indexes, research runs, saved
  sets, ranking, moderation policy, or UI integration.
- Do not copy the reference client's relay orchestration wholesale.
- Reuse a trusted Nostr protocol implementation where appropriate, but keep the
  public operation independent of UI and browser state.
- A relay returning zero events is a valid observable result, not proof of
  failure.

## Verification

- Exercise the public acquisition boundary against a deterministic temporary
  relay speaking actual NIP-01 messages and a temporary real SQLite database.
- Verify EOSE, timeout or failure distinction, event limits, invalid-event
  rejection, deduplication, provenance, and resource closure through observable
  behavior.
- Keep this as a black-box functional scenario; do not test private socket
  helpers or internal state transitions.
- During the task, attempt a bounded acquisition against multiple public relays
  and record the command and observable result in the worker report. Network
  availability is not a permanent test requirement.
- The independent reviewer should repeat a small live-relay operation when its
  environment permits and otherwise rely on the deterministic protocol
  scenario rather than inventing a network result.

## Acceptance criteria

- The CLI and library use the same acquisition and SQLite implementation.
- A successful operation stores real valid events that can be inspected with
  their relay observations.
- Partial relay failure does not discard evidence acquired from other relays.
- Timeout, EOSE, connection failure, cancellation, and limit completion remain
  distinguishable.
- Limits are enforced globally even when several relays respond concurrently.
- Invalid messages and events cannot enter memory.
- Commands terminate and owned network/database resources close.
- The reference client remains byte-for-byte unchanged.
- Permanent tests remain functional and do not freeze internal architecture.


# Worker report

Deliverables changed:
- Added forceful WebSocket teardown using pinned `ws` 8.20.0.
- Added functional scenarios for stalled handshakes and ignored closing handshakes.
- Updated package manifests and lockfile.

Validation:
- Package tests passed; four loopback tests skipped because sandbox networking forbids listeners.
- Syntax checks and `git diff --check` passed.
- Public relay attempt against `relay.damus.io` and `nos.lol` completed cleanly; both reported `connection-failure` due restricted network access.
- Direct CLI help succeeded.

Unresolved:
- Full validation’s final `npm exec` command attempted external resolution and hung; the equivalent repository-linked CLI command passed.
- Loopback closure scenarios require execution in an environment permitting local listeners.

# Validation output

Exit code: 0


> @nostr-research/memory@0.1.0 test
> node --test

(node:37179) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:37179) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (230.715083ms)
✔ global limit and cancellation are distinguishable and close owned sockets (166.966584ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (147.126916ms)
✔ timeout and partial connection failure remain observable (273.512542ms)
✔ acquisition rejects unusable public inputs before networking (5.971709ms)
(node:37180) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (30.122ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10459.707334

> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check bin/nostr-research-memory.js

(node:37292) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.