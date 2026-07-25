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
id: 010-composable-research-kernel
status: in_progress
max_attempts: 5
validation: workflow/tasks/010-composable-research-kernel.validate.sh
depends_on: 009-field-trial
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make account and conversation research composable

## Objective

Turn the field-trial friction into one coherent research kernel rather than a
collection of specialized workflows.

A caller should be able to resolve subjects, select or acquire evidence,
traverse explicit relationships, project useful representations, and retain
the resulting selection. Account research, conversation research, participant
discovery, and saved-research continuation must be compositions of these
shared operations.

The intended vocabulary is:

```text
resolve -> select/acquire -> traverse -> project -> retain
```

These are capabilities, not a mandated class hierarchy. Prefer the smallest
plain JavaScript design that makes the operations and data flow explicit.

## Architectural constraint

This task must not introduce a separate storage model, relationship engine,
result collection, or formatter for each convenience workflow.

- Events, accounts, tags, sets, and recorded runs are addressable subjects.
- Selection describes bounded evidence constraints.
- Traversal accepts subjects, relationship types, direction, depth, and limits.
- Projection renders shared results as compact, full, IDs, or NDJSON.
- Retention saves selected results with reasons and provenance.

Existing public operations may be adapted behind this vocabulary. Do not
duplicate them merely to satisfy new names. If complete unification would make
the API less clear, document the narrow boundary instead of building an
abstraction framework.

## Shared subjects and result collections

Define minimal public representations for subject references and reusable
research results.

- Subject references carry a type and stable identifier.
- A result collection preserves selected subjects plus the provenance or
  relationship evidence needed to explain them.
- Results from selection and traversal can be projected or retained without
  command-specific conversion and without reparsing rendered output.
- Existing event, account, run, and set identifiers remain stable.

Do not replace canonical stored Nostr events with summary objects. Projections
are views over evidence, not a second source of truth.

## Reusable selection

Expose one clear library-level selection operation for accumulated local
evidence. It must cover the existing useful constraints: identifiers, authors,
kinds, time bounds, exact tags, text, ordering, and limit.

Relay acquisition remains a distinct side-effecting operation because NIP-01
filters and relay outcomes matter. Reuse the overlapping selection vocabulary
where semantics truly match, but do not pretend local text search is a relay
filter or erase relay-specific fields.

Both operations must return reusable results rather than only rendered CLI
payloads.

## General traversal

Provide one library traversal operation over stored relationships with:

- one or more starting subjects;
- explicit relationship types;
- `inbound`, `outbound`, or `both` direction;
- bounded depth and maximum distinct results;
- deterministic order;
- edge evidence and interpretation retained in the result.

The same operation must support at least:

- event to direct replies and descendants;
- event to author, mentioned accounts, and topics;
- account to authored events and references;
- a collection of events to their participant accounts;
- expansion of saved research.

Cycles and duplicate paths must be bounded and deduplicated without losing an
explanation of how a retained subject was reached.

Ambiguous NIP-10 fallback edges must remain visibly different from known
marker-based relationships. Do not silently promote an unmarked `e` tag to a
definite reply.

Adapt existing `related event`, `related account`, and set expansion to use the
shared traversal behavior. Their public compatibility may remain as thin
conveniences.

## Shared projections

Replace command-specific compact shaping with shared projections over subjects
and result collections.

Useful compact projections must include:

- account: key, stored name/display name, NIP-05 when available, description
  excerpt, metadata event ID, and observed relays;
- event: ID, kind, author identity when known, creation time, bounded content
  excerpt, and observed relay count or names;
- set: identity, counts, and a bounded preview of member summaries;
- run: identity, operation, status, exact bounds/filter where recorded,
  outcome counts, and a bounded result preview;
- relationship/traversal: source and target summaries, direction, type, depth,
  and concise protocol interpretation.

`compact` must enable the next research choice without dumping complete signed
events. `full` remains the evidence representation. `ids` and `ndjson` remain
deterministic and composable. Provide a small explicit preview/excerpt limit
where needed; do not introduce terminal-width behavior, tables, or colors.

## Thin composed workflows

Add a focused conversation/thread operation as a composition of selection,
traversal, and projection. It should distinguish:

- the starting event;
- known ancestors when locally available;
- direct replies;
- deeper descendants;
- participating accounts;
- ambiguous references.

It must not implement another relationship parser or thread store.

Make the existing pieces sufficient for an account investigation:

1. resolve an account from stored name, NIP-05, key, or unambiguous prefix;
2. acquire metadata/recent events with the existing bounded acquisition API;
3. select authored evidence;
4. traverse mentions, replies, topics, or participants;
5. retain any resulting collection as a set;
6. reopen the database and continue from the retained set.

Convenience CLI commands are allowed only as thin translations into the shared
library operations. The library API is authoritative and must be usable
without invoking or parsing the CLI.

## Acquisition feedback

Project recorded or immediate acquisition results concisely with:

- exact relays and filter including explicit time bounds when supplied;
- per-relay EOSE, timeout, failure, or limit outcome;
- received, accepted, invalid, duplicate, observation, and newly stored counts;
- overall completion reason and recorded run ID;
- bounded result preview.

Do not change relay networking semantics in this task.

## Documentation

Update the package README with:

- the shared research vocabulary;
- one library example composing selection, traversal, projection, and
  retention;
- one CLI account-to-conversation investigation;
- the distinction between local selection and relay acquisition;
- how ambiguous protocol evidence is represented.

Keep documentation focused on public operations rather than internal module
structure.

## Scope boundaries

- Do not change the reference client.
- Do not add UI integration, ranking, recommendations, trust scores, social
  graph classification, moderation, or relay selection policy.
- Do not add an ORM, dependency-injection container, general graph framework,
  serializer framework, or command bus.
- Do not create separate account-research or thread-research databases.
- Do not add compatibility code for obsolete experimental sessions.
- Do not redesign the SQLite schema unless a small migration is demonstrably
  required for shared provenance; prefer existing tables.
- Do not create a unit test for each helper, projection, or CLI command.

## Verification

Keep permanent verification at meaningful boundaries:

- protocol-focused coverage for NIP-10 known versus ambiguous relationship
  interpretation and bounded cyclic traversal;
- one library-level functional scenario that composes local selection,
  multi-step traversal, projection, retention, close/reopen, and continuation;
- one black-box CLI scenario demonstrating useful compact account, set, and
  thread output while full evidence remains available.

The reviewer must independently use a disposable fixture-backed SQLite
database through the public library API, not only the CLI. The reviewer must
demonstrate two different research paths using the same selection and
traversal operations. Live relay access is optional because acquisition
networking is not being changed.

## Acceptance criteria

- The public library exposes reusable subject, selection, traversal,
  projection, and retention operations.
- Search, existing related operations, saved-set expansion, and the new thread
  workflow share those operations instead of parallel implementations.
- A result can flow from selection to traversal to projection to retention
  without parsing serialized CLI output.
- Thread output separates direct, descendant, ancestor, participant, and
  ambiguous relationships using retained protocol evidence.
- Compact account and set inspection provide enough information to choose a
  next operation; full mode preserves canonical evidence.
- Acquisition summaries expose exact request bounds and relay outcomes without
  flooding output.
- A retained selection can be reopened and continued through the same public
  operations.
- The implementation stays plain, cohesive, and materially easier to compose
  than adding more command-specific functions.
- Reference-client behavior and source remain unchanged.
- Permanent tests remain few, boundary-focused, and do not force unnecessary
  production helpers to stay public.



# Worker report

Implemented the composable Nostr research kernel.

Deliverables changed:

- Added public subject, resolve, select, traverse, project, retain, and thread operations.
- Routed related-event/account navigation and set expansion through shared traversal.
- Added compact/full/IDs/NDJSON projections with bounded previews.
- Added concise acquisition summaries with exact requests, relay outcomes, counts, and previews.
- Added CLI `thread` support and richer account/set output.
- Updated README with vocabulary and investigation examples.
- Added functional kernel and CLI coverage.

Validation performed:

- Full package test suite passed: 10 passed, 4 network-dependent skipped.
- Syntax checks passed.
- Task validation script passed.
- Protected paths remain unchanged.
- `git diff --check` passed.

Unresolved uncertainties:

- Live relay tests remain skipped because the sandbox forbids loopback listeners; relay networking semantics were not changed.

# Validation output

Exit code: 0


> @nostr-research/memory@0.1.0 test
> node --test

(node:56869) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56869) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (167.235041ms)
✔ global limit and cancellation are distinguishable and close owned sockets (103.126375ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (171.493334ms)
✔ timeout and partial connection failure remain observable (148.993458ms)
✔ acquisition rejects unusable public inputs before networking (3.347625ms)
(node:56876) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56894) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56896) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56898) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56915) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56917) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56935) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56936) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56937) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56953) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56954) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56955) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56957) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56990) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (630.022666ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (44.826333ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (177.236125ms)
(node:56871) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (35.181458ms)
(node:56872) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (29.640834ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (19.872833ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (24.714583ms)
(node:56873) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ selection, bounded traversal, projection, retention, reopen, and continuation compose (49.363875ms)
(node:56874) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56893) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56895) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56897) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56914) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56916) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:56934) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (340.767334ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10331.811542

> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check bin/nostr-research-memory.js

(node:57036) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.