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


# Selected task

---
id: 029-explicit-console-research-state
status: in_progress
max_attempts: 5
validation: workflow/tasks/029-explicit-console-research-state.validate.sh
depends_on: 028-prune-inactive-research-api
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make console research state explicit and finish the cleanup

## Objective

Make the persistent JavaScript console predictable: research operations return
values, and changing the active investigation is an explicit operation. Then
simplify session and presentation code around the smaller data model delivered
by task 028.

## Required behavior

- Local query, acquisition, expansion, reply-context resolution, filtering,
  facets, comparison, inspection, and traversal do not implicitly replace the
  active selection.
- One plainly named operation explicitly makes a result the active selection.
- Explicit traversal has one signature and one mutation behavior; do not
  overload argument count to switch between stateful and stateless operation.
- Retaining an explicit result and checkpointing the active selection have
  distinct names and signatures.
- Console status reports one authoritative corpus description rather than
  duplicate memory/corpus summaries.
- Closing the environment still cancels operations it owns.

Review the temporary session against actual console use. Keep a session module
where it contains genuine active-navigation state, but remove unused
focus/include/exclude/branch/view machinery if its complexity does not reappear
in the console. Do not preserve operations solely because old tests call them.
Backtracking or checkpoint behavior may remain only if it has a clear,
non-overloaded console operation.

Simplify presentation after removed run, coverage-registry, and generic-set
shapes disappear. Compact traversal and expansion output should summarize
relationship evidence by default rather than embedding large nested reason
structures; detailed inspection must remain available on request.

Finally reassess source locality. Extract a module only when it owns a coherent
implementation concern and makes callers simpler. Leaving the reduced core in
one file is acceptable; creating pass-through modules is not.

## Boundaries

- Do not add a UI, command language, database, persistence, browser bundler, or
  plugin/widget system.
- Do not rename the entire memory/corpus vocabulary as cosmetic churn.
- Do not introduce controllers, services, repositories, dependency injection,
  or generic adapters.
- Keep dynamic JavaScript composition and the process-lifetime REPL.
- Test public console workflows and protocol rules, not helper implementation
  details.

## Documentation and verification

Update active README, console help, and canonical context to describe the exact
remaining console operations and explicit state rule.

Run a console-driven functional scenario that:

1. imports or acquires evidence;
2. performs multiple local queries without changing active state;
3. explicitly activates one result;
4. traverses it without hidden mutation;
5. explicitly activates the traversal;
6. retains findings; and
7. inspects both compact and detailed output.

## Acceptance criteria

- Console operations have predictable mutation semantics.
- There are no overloads whose argument count changes whether session state is
  mutated.
- Session code contains only capabilities available and useful through the
  active console workflow.
- Compact presentation is bounded and detailed evidence remains inspectable.
- Documentation matches the actual interface.
- No speculative architecture is introduced.
- Functional tests, syntax checks, and the console scenario pass.


# Worker report

Deliverables changed:
- Corrected root README console example to valid `--capacity 1000`.
- Existing task implementation and documentation remain intact.

Validation:
- Syntax checks passed.
- Functional tests passed: 12 passed, 10 network tests skipped due to sandbox restrictions.
- Overload guard passed.
- `git diff --check` passed.

Unresolved uncertainties:
- None.

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

(node:38017) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (117.339292ms)
✔ global limit and cancellation are distinguishable and close owned sockets (120.833375ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (84.323083ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (163.865541ms)
✔ timeout and partial connection failure remain observable (174.938708ms)
✔ acquisition rejects unusable public inputs before networking (0.430291ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.544166ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (78.19375ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (128.168666ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (163.915042ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (103.234917ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (206.753125ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (349.966125ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (25.611792ms)
✔ process-local memory preserves canonical evidence and independent relay observations (39.500791ms)
✔ presentation and facets orient surviving research values (67.470792ms)
✔ replaceable selection and follow interpretation remain stable in one process (68.01025ms)
✔ public local search composes constraints, explains matches, and preserves provenance (39.807375ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (39.940916ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2466.505834ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (43.550792ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (37.515291ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10336.685834


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.