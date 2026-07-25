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
id: 016-protocol-correct-account-relationships
status: in_progress
max_attempts: 5
validation: workflow/tasks/016-protocol-correct-account-relationships.validate.sh
depends_on: 015-console-research-field-trial
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make account relationships and replaceable events protocol-correct

## Reason

The first persistent-console investigations exposed a concrete semantic error:
the library currently interprets every `p` tag as an account mention. A `p`
tag in a kind-3 contact list is follow evidence, not an ordinary mention.
Research traversal therefore works mechanically but can explain the
relationship incorrectly.

The same investigations also encountered multiple historical kind-3 events
when ordinary research wanted the current contact list. Raw historical
evidence must remain preserved while the semantic view selects the current
replaceable event correctly.

## Objective

Separate raw Nostr tag evidence from its event-kind interpretation and provide
one cohesive current-event operation for replaceable protocol records.

## Relationship interpretation

- Continue preserving canonical events and their raw tags unchanged.
- Interpret kind-1 and other ordinary-event `p` tags as mentioned accounts
  where that meaning is valid.
- Interpret kind-3 `p` tags as followed accounts.
- Expose an explicit `follow` relationship type in navigation and explanation.
- A follow explanation must identify the source kind-3 event and exact `p`
  tag. It is evidence that the contact-list event named an account, not a
  claim of trust, endorsement, identity, or current social closeness.
- Do not preserve the incorrect `mentioned-account` interpretation for kind-3
  evidence solely for experimental compatibility.

Existing stored canonical events may be reinterpreted or their derived
relationship rows rebuilt. There is no legacy experimental database contract
to preserve, but canonical evidence and observations must not be discarded.

## Current replaceable events

Provide one small public operation that selects the current stored event using
NIP-01 semantics for:

- kinds 0 and 3;
- replaceable kinds in the 10000–19999 range, including kind 10002; and
- parameterized replaceable kinds in the 30000–39999 range using the `d` tag.

Use the protocol timestamp and event-ID tie-break rules consistently. Historical
events remain directly inspectable as evidence.

The operation should be reusable by profile metadata, follow navigation, relay
list interpretation, and later protocol-specific views rather than duplicating
current-event selection in each feature.

## Direct follow navigation

Expose a direct UI-independent operation usable from the console:

```js
const followed = research.follows(account)
```

It must:

- resolve the account through existing subject rules;
- use its current stored kind-3 event;
- return followed accounts as a shared result collection;
- preserve unresolved followed public keys as navigable account subjects;
- retain exact event/tag reasons and observation provenance; and
- return an empty explainable result when no current contact list is stored.

It must not acquire relays automatically or imply reciprocity.

## Boundaries

- No recommendation, trust, popularity, spam, or interestingness scores.
- No general NIP framework or event-class hierarchy.
- No UI, default relays, background acquisition, or graph visualization.
- Do not create a second relationship engine beside the existing one.
- Do not add backward-compatibility branches for incorrect experimental
  derived rows.

## Documentation

Document raw evidence versus interpreted relationship, historical versus
current replaceable events, and follow evidence versus endorsement.

## Verification

Use a small protocol-focused public functional scenario containing:

- historical and current kind-3 events for one account;
- a kind-1 mention using the same `p` tag vocabulary;
- equal-timestamp replaceable events that exercise the event-ID tie-break;
- kind-10002 and parameterized-replaceable examples;
- follow traversal with resolved and unresolved accounts; and
- close/reopen verification proving canonical history remains present while
  the semantic view remains stable.

Drive public library and console-facing operations. Do not test private SQL or
tag helpers individually.

## Acceptance criteria

- Kind-3 `p` tags are explained as follows, not mentions.
- Ordinary mentions keep their correct meaning.
- Current replaceable selection follows NIP-01 semantics.
- Raw historical canonical evidence remains available.
- `research.follows(account)` returns a composable, provenance-preserving
  result collection.
- Existing search, traversal, sessions, retention, and CLI behavior remain
  usable.


# Worker report

Deliverables changed:

- Added protocol-correct `follow` relationships for kind-3 `p` tags.
- Added public `memory.currentEvent(...)`, `memory.follows(...)`, and console equivalents.
- Added derived-relationship rebuilding while preserving canonical evidence.
- Added protocol-focused functional coverage and documentation.

Validation:

- Task validator passed.
- 18 tests passed; 4 network tests skipped due to sandbox restrictions.
- Syntax checks and `git diff --check` passed.
- No files staged or committed.

Unresolved uncertainties: none.

# Validation output

Exit code: 0


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:54110) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54110) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (182.307458ms)
✔ global limit and cancellation are distinguishable and close owned sockets (172.703792ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (158.258125ms)
✔ timeout and partial connection failure remain observable (153.812417ms)
✔ acquisition rejects unusable public inputs before networking (15.254333ms)
(node:54119) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54144) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54170) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54172) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54174) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54198) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54200) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54201) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54224) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54225) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54226) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54227) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54237) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54284) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (791.3275ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (46.705625ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (195.7145ms)
(node:54112) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ one console process preserves JavaScript state and composes a bounded research loop (282.124125ms)
(node:54113) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (53.819791ms)
(node:54114) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ replaceable selection and follow interpretation remain stable across reopen (101.554ms)
(node:54115) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (86.941125ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (29.114542ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (40.194833ms)
(node:54116) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ large retention is atomic, bounded, durable, and remains directly navigable (2108.272042ms)
(node:54117) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (103.875458ms)
(node:54118) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54143) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54169) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54171) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54173) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54197) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:54199) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (490.641334ms)
(node:54142) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public session actions remain temporary while checkpoints are durable (55.766ms)
✔ sessions start from public runs returned by recordRun and getRun (16.716417ms)
✔ bounded attempt coverage distinguishes exact attempted slices from uncertainty (30.604292ms)
✔ advertised NIP-11 limits and stored NIP-65 evidence have stable protocol semantics (2.449708ms)
(node:54145) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ bounded workspace supports an iterative public research loop over durable evidence (76.1435ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10441.610167

> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/session.js && node --check src/planning.js && node --check src/console.js && node --check bin/nostr-research-memory.js && node --check bin/nostr-research-console.js

(node:54346) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.