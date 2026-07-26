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

Annotations belong to memory's replaceable derived material. They can outlive
eviction of the canonical event or profile they reference, but disappear with
`reset()`, `close()`, or process exit. Annotation labels have only the meaning
assigned by their caller.


# Selected task

---
id: 033-minimal-collection-algebra
status: in_progress
max_attempts: 4
validation: workflow/tasks/033-minimal-collection-algebra.validate.sh
depends_on: 032-stable-subject-collections
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md
reviewer_sandbox: workspace-write
---

# Add the minimal typed collection algebra

## Objective

Replace the most repeatedly handwritten neutral JavaScript from the five field
trials with a small JSON-serializable algebra over typed, reason-bearing
collections.

This task covers local transformations only:

- `filter`
- `group`
- `summarize`
- `move`

Existing `retain` remains the explicit lifecycle operation. Bounded relay
acquisition and hydration remain separate existing operations in this task.

## Collection and operation model

- Inputs and outputs have explicit kinds sufficient to distinguish events,
  accounts, relationships, groups, and summaries.
- Invalid input/output combinations fail before partial execution.
- Operations accept plain data descriptions, not caller callbacks or
  executable strings.
- Every stage is inspectable and may be named in context.
- Subject reasons and evidence/provenance references survive transformations
  where they remain applicable.
- Empty results are valid and preserve enough context to explain the attempted
  path.

## Filter

Support positive and negative composition with `all`, `any`, and `not`.
Initially support only fields repeatedly evidenced by the trials:

- subject type and ID;
- event author, kind, text, structured tags, linked domains, and media
  presence;
- account/profile name and description text;
- resident versus nonresident evidence.

Do not encode spam, quality, topic, person/project, or credibility rules.

## Group and summarize

Grouping must cover the repeated stable keys from the trials: subject,
event author, kind, tag, linked domain, and observed relay.

Summaries must use explicit aggregations rather than an open-ended
`summarize` callback. Begin with:

- `count`
- `distinct`
- `sample`
- `collect`
- `min`
- `max`

All results must stay bounded by caller-supplied limits with conservative
defaults.

## Move

Support the repeatedly observed neutral subject transitions:

- events to authors/accounts;
- events to referenced accounts/events when protocol relationships support
  them;
- accounts to authored resident events;
- accounts to followed accounts using current kind-3 semantics.

Do not infer semantic group membership or automatically acquire missing data.

## Boundaries

- Do not build a textual DSL, shell parser, visual graph, or general scripting
  language.
- Do not put acquisition, hydration, eviction, or automatic retention inside
  local transforms.
- Do not add a generic join engine or SQL-like expression language.
- Keep the implementation inside the existing simple library structure.
- Add functional scenarios at the public algebra boundary. Do not create one
  unit test per operation, predicate, aggregation, or helper.

## Acceptance criteria

- Trial-style positive/negative refinement is expressible without JavaScript
  predicates.
- Per-author grouping, counting, representative sampling, and balancing are
  expressible without `Map`, `reduce`, or manual `.items` aggregation.
- Event-to-account movement and current account evidence are composable.
- Operations are JSON-serializable, typed, bounded, reason-preserving, and
  deterministic over the same resident corpus.
- Unsupported combinations fail clearly.
- Existing library and console behavior remains usable.
- Functional tests and syntax checks pass.


# Worker report

Implemented the minimal typed collection algebra.

Deliverables changed:

- Added `memory.transform()` with typed, JSON-serializable `filter`, `group`, `summarize`, and `move` stages.
- Added bounded aggregations, predicate composition, stage naming/context, deterministic outputs, and reason/provenance preservation.
- Added functional algebra scenarios.
- Documented the public API in the README.

Validation:

- Task validation passed.
- 16 tests passed; 13 network tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks and `git diff --check` passed.
- No protected files, workflow status, or run artifacts were modified by me.

Unresolved uncertainties:

- Live relay scenarios were not runnable in this sandbox; local algebra behavior is fully validated.

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

(node:63534) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (190.424292ms)
✔ account hydration derives a bounded metadata filter from account subjects (95.738958ms)
✔ global limit and cancellation are distinguishable and close owned sockets (86.43025ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (80.419792ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (62.884291ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (170.009125ms)
✔ timeout and partial connection failure remain observable (121.490208ms)
✔ acquisition rejects unusable public inputs before networking (0.540416ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.543583ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (182.305ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (91.871417ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (72.335166ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (192.704ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (117.39425ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (122.22475ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (41.24375ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.318542ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (301.577709ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (30.419625ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (22.769333ms)
✔ process-local memory preserves canonical evidence and independent relay observations (42.135958ms)
✔ presentation and facets orient surviving research values (45.341625ms)
✔ replaceable selection and follow interpretation remain stable in one process (57.468084ms)
✔ public local search composes constraints, explains matches, and preserves provenance (53.825666ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (20.686167ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2393.541708ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (26.805875ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (30.354209ms)
✔ retained reactivation does not recreate evicted canonical evidence (5.769875ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10450.160916


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.