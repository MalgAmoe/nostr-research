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
id: 008-agent-friendly-cli-output
status: in_progress
max_attempts: 5
validation: workflow/tasks/008-agent-friendly-cli-output.validate.sh
depends_on: 007-saved-research
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make CLI output compact and composable

## Objective

Make the existing research CLI practical for interactive human and Codex use
without weakening the complete evidence representations already available.

Real use showed that acquisition, run listing, set listing, search, and
relationship navigation emit enough repeated JSON to consume thousands of
lines for modest result sets. This task changes projection and presentation,
not research semantics or stored data.

## Global output contract

Support one consistent CLI option:

```text
--output compact|full|ids|ndjson
```

The option must work in a predictable position documented by `--help`.
Unsupported output modes must fail non-zero with a useful message.

Meanings:

- `compact`: structured JSON containing the information needed to select a next
  operation, with bounded content excerpts and no repeated evidence payloads;
- `full`: the current complete structured representation, including canonical
  events, observations, reasons, diagnostics, and relationship evidence;
- `ids`: a JSON array of relevant result identifiers, preserving event/account
  type when a command can mix entity types;
- `ndjson`: one compact result record per line, with an optional first metadata
  record only when needed to preserve query or operation context.

Output must remain deterministic and machine-readable. Do not introduce
terminal tables, color, interactive prompts, or parsing based on screen width.

## Command defaults

- `acquire`, `search`, `accounts`, `related`, `run list`, and `set list`
  default to `compact`.
- Explicit evidence inspection commands (`inspect`, `account`, `run inspect`,
  `set inspect`, and `set explain`) default to `full`.
- Mutating set commands default to a compact acknowledgement with stable set
  identity and relevant member counts.
- `--output full` must preserve access to all previously observable information.

## Compact projections

### Acquisition

Return:

- database path;
- completion reason and recorded run ID when present;
- received, invalid, observations, newly stored, and duplicate counts;
- one concise outcome per requested relay;
- acquired event IDs.

Do not include the full acquired-observation or recorded-run result payload
unless `full` is requested.

### Event and account search

Each compact event result contains:

- ID, kind, author, creation time;
- a bounded single-line content excerpt;
- distinct relay names;
- concise but unambiguous match reasons.

Each compact account result contains:

- public key;
- current display/name fields that are actually stored;
- source metadata event ID and relay names;
- match reasons.

Do not invent missing profiles, trust, ranking, or display data.

### Relationships

Return the subject once. Each compact relationship contains only:

- direction and relationship type;
- target type, ID, and resolution state;
- source event ID;
- protocol and interpretation evidence needed to understand the edge.

Do not repeat a complete source event and observations inside every
relationship. `full` retains the complete representation.

### Runs and sets

- `run list` returns ID, operation, status, start/finish times, result count,
  and diagnostic count.
- `set list` returns ID, name, creation time, total member count, event count,
  and account count.
- Detailed run results, set members, membership reasons, and provenance remain
  available through explicit inspection or `--output full`.

## Invocation ergonomics

Add one obvious root npm command so the CLI can be invoked without knowing its
source path, for example:

```text
npm run research -- --db .data/research.sqlite search ...
```

It must use the local workspace binary and must not attempt a registry lookup.
Document it in the root and package README.

Do not hide all Node warnings globally. If the built-in SQLite experimental
warning can be suppressed narrowly and portably for the CLI entry point, do
so; otherwise document it as runtime noise and leave it unchanged.

## Scope boundaries

- Do not change acquisition, query, navigation, run, or set semantics.
- Do not change the SQLite schema.
- Do not add pagination, ranking, recommendations, set-to-filter generation,
  UI integration, or new research methodology.
- Do not remove full evidence or provenance.
- Do not introduce a general serializer framework or duplicate public domain
  objects solely for each command.

## Verification

- Adapt the existing black-box CLI functional scenarios rather than creating
  a test for every command and output mode.
- Verify that one representative acquisition/search/relationship/list flow is
  concise and machine-readable, and that `full` still exposes complete
  evidence.
- Verify `ids` can feed a subsequent command without text scraping.
- Verify NDJSON records can be parsed independently.
- The independent reviewer must run a small real or fixture-backed research
  path and compare compact versus full output size and usefulness.

## Acceptance criteria

- Default output for result-producing commands is materially smaller than the
  current full representation.
- A caller can identify results and choose a next operation without requesting
  full output.
- Compact relationships do not duplicate source events.
- List commands do not expand complete runs or sets by default.
- Full mode retains complete evidence, provenance, reasons, and diagnostics.
- IDs and NDJSON modes are deterministic and composable.
- The root npm command invokes the local CLI without hanging or registry
  lookup.
- Existing public library behavior and SQLite data remain unchanged.
- Reference-client behavior and source remain unchanged.
- Permanent test growth remains small and boundary-focused.


# Worker report

Deliverables changed:

- Updated root and package READMEs to document `npm run --silent research -- …`.
- Added boundary coverage proving the documented root invocation emits directly parseable JSON without npm’s banner.

Validation performed:

- Focused CLI output tests: 3 passed.
- Full task validation: 9 passed, 4 network tests skipped by sandbox.
- Syntax checks and `git diff --check`: passed.

Unresolved uncertainties:

- None. Node’s SQLite experimental warning remains on stderr only and does not affect JSON stdout.

# Validation output

Exit code: 0


> @nostr-research/memory@0.1.0 test
> node --test

(node:50057) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50057) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (89.011542ms)
✔ global limit and cancellation are distinguishable and close owned sockets (114.714458ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (155.530833ms)
✔ timeout and partial connection failure remain observable (143.376042ms)
✔ acquisition rejects unusable public inputs before networking (3.329541ms)
(node:50062) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50079) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50096) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50098) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50110) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50117) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50119) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50120) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50136) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50137) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50138) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50140) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50175) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ CLI projections remain concise, complete, deterministic, and composable (578.736208ms)
✔ CLI rejects unsupported output modes with a useful non-zero error (46.710791ms)
✔ documented root npm launcher emits parseable CLI output without an npm banner (192.985417ms)
(node:50059) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ SQLite memory preserves canonical evidence and independent relay observations (34.821459ms)
(node:50060) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public local search composes constraints, explains matches, and preserves provenance (26.406792ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (17.330916ms)
✔ navigation exposes direction, protocol interpretation, unresolved targets, and provenance (23.327666ms)
(node:50061) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50078) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50080) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50097) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50099) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50116) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
(node:50118) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ recorded query becomes an explainable, expandable, combinable durable research path (338.741667ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10266.992084

> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check bin/nostr-research-memory.js

(node:50214) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.