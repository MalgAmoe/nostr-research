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
id: 034-named-research-plans-field-trial
status: in_progress
max_attempts: 4
validation: workflow/tasks/034-named-research-plans-field-trial.validate.sh
depends_on: 033-minimal-collection-algebra
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md
reviewer_sandbox: workspace-write
---

# Compose and field-test named research plans

## Objective

Integrate the collection algebra with the existing bounded acquisition,
hydration, and retention lifecycle as a small named-stage research plan, then
test it on live Nostr research.

The goal is not to build the final language. It is to prove that one plain-data
representation can drive the recurring research loop while leaving judgment
with the caller.

## Plan model

A plan is a JSON-serializable list of named stages. A stage:

- has a stable stage ID;
- declares one operation and its plain-data parameters;
- refers explicitly to prior stage inputs;
- produces an inspectable typed result or bounded external-operation report;
- preserves reasons, evidence references, provenance, and resident status.

Linear execution is sufficient. Do not add branching syntax, a graph runtime,
incremental recomputation, or plan persistence. Named prior stages may be
reused only where this falls naturally out of the simple representation.

## External and lifecycle stages

Integrate existing operations rather than duplicating them:

- bounded `acquire`;
- bounded `hydrate`;
- explicit `retain`.

External stages expose relays, timeouts, observation/distinct-event limits, and
their completion reports. No acquisition or retention is implicit.

User judgments such as chosen tags, excluded domains, selected examples,
labels, names, and reasons are supplied plan data. The engine must not invent
them.

## Field trial

Run a fresh live trial from a mostly random bounded buffer:

1. orient;
2. choose a direction from observed evidence;
3. filter positively and negatively;
4. group or summarize;
5. move to accounts or related subjects;
6. hydrate where explicitly requested;
7. retain at least five subjects with supplied reasons.

Record:

- the complete plan data actually executed;
- acquisition/corpus budgets and eviction;
- stage result kinds and concise counts;
- user/agent judgments supplied as parameters;
- any JavaScript still required outside the plan;
- failed or awkward operations;
- whether the abstraction should be kept, reduced, or adjusted.

Write the report to
`workflow/artifacts/declarative-research-plan-field-trial.md`.

## Cleanup

Make only small corrections directly supported by the field trial. Remove
unused or redundant algebra/plan surface rather than preserving speculative
features. Update active documentation with the proven interface.

## Boundaries

- No UI, textual DSL, Rust port, persistence, database, plugin system, or
  automatic classifier.
- Do not modify the earlier five-trial artifact; it is protected evidence.
- Do not add operations merely because they might be useful later.
- Use functional validation at the public plan boundary, plus the live trial.
  Do not duplicate every algebra test at the plan layer.

## Acceptance criteria

- One plain-data named plan performs the complete bounded research loop.
- The report contains the exact plan and remaining JavaScript.
- No domain judgment is hidden in the engine.
- Acquisition and hydration remain explicit and bounded.
- Reasons, provenance, and resident status remain inspectable.
- The final public surface contains only operations justified by the trials.
- Functional tests, syntax checks, and the documented validation scenario
  pass.


# Worker report

Deliverables changed:

- Updated `workflow/artifacts/declarative-research-plan-field-trial.md` with the complete JavaScript used outside the plan:
  - bounded orientation acquisition;
  - facet inspection;
  - plan execution;
  - stage-count projection;
  - hydrated-profile projection;
  - corpus cleanup.
- Documented the exact plan-construction relationship to the authoritative JSON plan without duplicating it.

Validation:

- Task validation script passed.
- Syntax checks passed.
- 17 tests passed, 14 network/loopback tests skipped by sandbox, 0 failed.

Unresolved uncertainties:

- None.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-console.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:71664) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (147.204333ms)
✔ account hydration derives a bounded metadata filter from account subjects (42.216541ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (85.524917ms)
✔ global limit and cancellation are distinguishable and close owned sockets (104.084917ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (88.340125ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (139.166125ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (175.623041ms)
✔ timeout and partial connection failure remain observable (176.3955ms)
✔ acquisition rejects unusable public inputs before networking (0.544125ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.509666ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (137.503333ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (57.623625ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (45.094417ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (116.299542ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (214.665209ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (131.776333ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (47.235583ms)
✔ empty paths retain typed context and invalid plans fail before execution (1.001292ms)
✔ a local-only named plan can query resident memory without implicit acquisition (1.146958ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (284.627334ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (28.243209ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (21.2515ms)
✔ process-local memory preserves canonical evidence and independent relay observations (25.533416ms)
✔ presentation and facets orient surviving research values (45.599917ms)
✔ replaceable selection and follow interpretation remain stable in one process (57.645708ms)
✔ public local search composes constraints, explains matches, and preserves provenance (35.162667ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (30.3165ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2270.196083ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (28.999833ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (28.129125ms)
✔ retained reactivation does not recreate evicted canonical evidence (6.529125ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10458.036417


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.