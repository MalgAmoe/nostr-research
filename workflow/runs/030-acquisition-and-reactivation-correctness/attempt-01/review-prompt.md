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
| **session** | The temporary, in-process owner of the console's explicitly activated selection and its last meaningful state action. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | Information returned by one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing or create a global history record. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **retained selection** | A deliberately retained, named result collection with its subjects and reasons for later inspection during the running process. |
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

Memory is the only authoritative corpus. A session owns only the console's
explicitly activated selection and its last state action. All query,
acquisition, expansion, reply-context, filtering, facet, comparison,
inspection, and traversal operations return values without changing that
selection. Activation is a separate explicit operation. Retaining a supplied
result and checkpointing the active selection are distinct operations. A result
collection is the shared operation result passed between these layers. Retained
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


# Selected task

---
id: 030-acquisition-and-reactivation-correctness
status: in_progress
max_attempts: 5
validation: workflow/tasks/030-acquisition-and-reactivation-correctness.validate.sh
depends_on: 029-explicit-console-research-state
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Correct acquisition trust, composed budgets, and retained reactivation

## Objective

Fix four correctness gaps found by the post-refactor code review without
expanding the architecture:

1. only ingest relay events that match the exact NIP-01 filter requested;
2. count distinct events once across every nested request in one composed
   expansion or reply-context operation;
3. reject unknown direct-acquisition options; and
4. allow retained selections to become the active console selection again.

## Relay filter trust

After canonical event validation, verify that an `EVENT` received for a
subscription satisfies the normalized filter sent in its `REQ`. Use the
protocol implementation supplied by `nostr-tools` when suitable rather than
creating a partial local interpretation.

A canonical but non-matching event:

- must not be ingested;
- must not consume observation or distinct-event budgets;
- must not appear in acquired observations or additions;
- must be observable in per-relay and aggregate diagnostics/counts; and
- must not make coverage claim that it was evidence returned for the requested
  slice.

Malformed packets and invalid canonical events retain their existing distinct
reporting.

## Composed distinct-event budgets

Expansion and reply-context resolution issue several sequential relay
requests. Their distinct-event limits are operation-wide, so events already
counted by an earlier request must not consume the remaining distinct-event
allowance again.

Keep the low-level direct acquisition operation independently useful. Deepen
its existing budget implementation or otherwise centralize the accounting;
do not add a generic orchestration framework. Reports must continue to expose
per-request counts while aggregate counts describe distinct IDs across the
complete composed operation.

Add functional scenarios where a later filter first returns an event obtained
by an earlier filter and then returns a genuinely new event. The new event must
still be acquired when the operation has distinct-event capacity for it.

## Acquisition option validation

Direct acquisition must reject unknown option keys before networking. This
includes the removed `eventLimit` name. It must never silently fall back to
default limits when the caller misspells or uses an obsolete bound.

Expansion and reply-context option validation remain coherent with this rule.

## Retained-selection activation

Both the summary returned by `retain()` and the full retained selection from
`getSet()` must be accepted by the explicit console/session activation
operation. Reuse one canonical retained-selection-to-collection conversion
path for construction and later activation.

Reactivation restores subjects and retained reasons without contacting relays,
mutating canonical evidence, or claiming that evicted evidence is resident.

## Boundaries

- Do not add relay trust scores, retry policy, persistence, pagination, or
  automatic session mutation.
- Do not introduce an acquisition service, repository, adapter hierarchy, or
  generic budget framework.
- Do not restore removed runs, coverage history, or set algebra.
- Permanent tests should exercise the public acquisition, composed-operation,
  and console/session seams. Do not expose private helpers for testing.

## Documentation

Update active README and canonical context where trust validation, composed
budgets, or retained reactivation need clarification. Historical tasks and
field-trial artifacts remain historical records.

## Acceptance criteria

- Non-matching canonical relay events are rejected before ingestion and
  explicitly counted.
- Coverage and acquired collections contain only canonical matching events.
- Observation and distinct-event limits remain hard bounds.
- Expansion and reply-context distinct limits count an ID only once across all
  nested requests.
- Unknown acquisition options fail before any relay is contacted.
- A retained summary and a full retained selection can both be explicitly
  activated.
- Query, acquisition, expansion, and traversal remain stateless with respect
  to active selection.
- All functional tests and syntax checks pass, including loopback relay tests.


# Worker report

Implemented task 030.

Deliverables changed:

- Enforced exact NIP-01 filter matching with `nostr-tools`.
- Added per-relay and aggregate `nonMatching` diagnostics.
- Shared distinct-event accounting across composed expansion and reply-context requests.
- Rejected unknown direct-acquisition options before networking.
- Unified retained-summary/full-set conversion for explicit session activation.
- Added functional coverage for filtering, composed budgets, option validation, reactivation, and evicted evidence.
- Updated README and canonical context.

Validation:

- `npm run check` passed.
- `npm test` passed: 13 passed, 12 loopback tests skipped because this sandbox forbids listeners.
- Task validation script passed.
- `git diff --check` passed.
- No obsolete acquisition option remains in active source/docs.

Unresolved uncertainties:

- Loopback scenarios could not execute in this sandbox; they remain available for runner/reviewer validation.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-console.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:41431) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (156.257542ms)
✔ global limit and cancellation are distinguishable and close owned sockets (102.123917ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (80.18575ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (74.060458ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (193.462333ms)
✔ timeout and partial connection failure remain observable (141.52175ms)
✔ acquisition rejects unusable public inputs before networking (0.45725ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.540416ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (108.6925ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (41.523542ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (41.037833ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (147.094334ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (102.26425ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (116.658667ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (301.080375ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (29.782834ms)
✔ process-local memory preserves canonical evidence and independent relay observations (29.03ms)
✔ presentation and facets orient surviving research values (44.86325ms)
✔ replaceable selection and follow interpretation remain stable in one process (61.950708ms)
✔ public local search composes constraints, explains matches, and preserves provenance (47.694125ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (32.897084ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2327.250417ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (31.163125ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (27.383584ms)
✔ retained reactivation does not recreate evicted canonical evidence (6.489375ms)
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10359.243333


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.