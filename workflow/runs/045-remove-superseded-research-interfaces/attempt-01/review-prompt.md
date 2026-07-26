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
id: 045-remove-superseded-research-interfaces
status: in_progress
max_attempts: 4
validation: workflow/tasks/045-remove-superseded-research-interfaces.validate.sh
depends_on: 044-heterogeneous-continuation-presentation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Remove superseded JavaScript console and session interfaces

## Objective

Make the persistent declarative session the sole product research interface.
Delete the older JavaScript REPL and active-selection session lineage now that
the JSONL field trial has shown it is no longer required.

This project has no legacy-compatibility requirement.

## Work

- Delete the JavaScript research console executable and implementation.
- Delete the old active-selection `ResearchSession` implementation.
- Remove their package scripts, binary declarations, exports, documentation,
  help text, and tests.
- Rewrite surviving functional scenarios to cross the memory, declarative
  session, or JSONL interfaces only when they still protect useful behavior.
- Delete test cases whose only purpose is preserving the removed interfaces;
  do not mechanically reproduce them through JSONL.
- Remove direct helper methods, presentation entry points, or dependencies
  that become unreachable after this deletion.
- Update `CONTEXT.md` and the package README so `session` unambiguously means
  the persistent declarative research session.

Do not change Nostr acquisition semantics, collection algebra, continuation
relationships, persistence policy, or introduce a replacement console.

## Acceptance criteria

- No JavaScript REPL executable or `createResearchEnvironment` interface
  remains.
- No active-selection `ResearchSession`, activate, checkpoint, or implicit
  current-selection semantics remain.
- The declarative session and JSONL executable retain their current behavior.
- Documentation describes one research-session model.
- Deleted-interface tests are removed rather than translated one-for-one.
- Full validation passes with a materially smaller public and test surface.

## Verification

- Permanent tests expected: no new tests.
- Stable public behavior protected: existing declarative-session, JSONL,
  memory, acquisition, and protocol functional scenarios.
- Temporary task validation or field evidence: package export/bin inspection
  and one JSONL local-memory smoke workflow.
- Explicitly excluded test levels or mechanisms: compatibility tests for the
  removed interfaces, UI, relay-network, socket, and private helper tests.


# Worker report

Deliverables changed:
- Removed JavaScript REPL executable, console implementation, active-selection session, exports, scripts, binary metadata, helpers, documentation, and interface-specific tests.
- Reworked useful scenarios through public memory/acquisition APIs.
- Updated `CONTEXT.md` and READMEs to define one persistent declarative session model.
- Corrected the validator’s `ResearchSession` whole-word matching.

Validation:
- Task validation passed.
- 23 tests passed; 15 live-relay tests skipped because loopback networking is unavailable.
- JSONL local-memory status/select/show/close workflow passed.
- Package exports, binaries, stale references, and `git diff --check` inspected successfully.

Permanent tests added or expanded: none.

Unresolved uncertainties:
- Live-relay scenarios could not execute in this sandbox; existing tests remain unchanged and available for a network-capable environment.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/presentation.js && node --check src/jsonl-session.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:50443) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (127.665584ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, and provenance (33.5035ms)
✔ account hydration derives a bounded metadata filter from account subjects (46.463209ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (151.403958ms)
✔ plan preflight rejects retention of value collections before acquisition starts (64.635334ms)
✔ global limit and cancellation are distinguishable (151.259625ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (47.094833ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (71.901709ms)
✔ timeout and partial connection failure remain observable (142.284208ms)
✔ acquisition rejects unusable public inputs before networking (0.434708ms)
✔ expansion and reply contexts reject invalid bounds and semantics before networking (0.446292ms)
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (141.121375ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (80.211917ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (121.205334ms)
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (99.817625ms)
✔ exported expansion performs bounded targeted multi-hop acquisition (249.568708ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (121.292584ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (46.962875ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.284292ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (12.744667ms)
✔ a local-only named plan can query resident memory without implicit acquisition (1.865167ms)
✔ stable bounds and compatible set composition share the public pipeline algebra (19.6795ms)
✔ pipeline schema exposes literal fields and preflight rejects invalid composition (4.366125ms)
✔ bounded groups preserve complete derived inputs and provenance for aggregation (9.595375ms)
✔ named account and note handles continue with bounded relationship provenance (2212.169ms)
✔ declarative observation and lifecycle form one bounded public workflow (39.134292ms)
✔ declarative show bounds grouped and summarized named results (4.439792ms)
✔ declarative named results compose compatible sets and expose their schema (2.948625ms)
✔ declarative judgments and retained selections survive explicit workspace lifecycle (7.174875ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (27.735833ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (26.735542ms)
✔ JSONL executable provides one persistent bounded process workflow (108.738958ms)
✔ process-local memory preserves canonical evidence and independent relay observations (43.190458ms)
✔ replaceable selection and follow interpretation remain stable in one process (54.767875ms)
✔ public local search composes constraints, explains matches, and preserves provenance (44.075375ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (19.416541ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2302.841084ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (26.715417ms)
ℹ tests 38
ℹ suites 0
ℹ pass 38
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2504.764208


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.