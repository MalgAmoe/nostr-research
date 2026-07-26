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
id: 041-selection-driven-navigation
status: in_progress
max_attempts: 4
validation: workflow/tasks/041-selection-driven-navigation.validate.sh
depends_on: 040-composable-collection-pipelines
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Let selections directly drive bounded Nostr navigation

## Objective

Allow the result of one research decision to become the input of the next
bounded local or relay operation without manually extracting and pasting
subject identifiers.

## Work

Add one typed continuation/expansion operation whose relationship determines
the traversal. It must cover the relationships already justified by the
library and field trials:

- notes authored by selected accounts;
- profile and follow-list hydration;
- followed accounts and evidence-backed followers;
- replies, ancestors, mentions, quotes, and referenced events;
- bounded conversation context;
- shared tags and linked domains;
- bounded expansion from selected notes or accounts.

The operation must accept named handles directly, derive protocol filters from
stable subject identities, respect explicit relay/time/event budgets, ingest
new evidence into the same canonical corpus, and return a new scoped handle.

Distinguish unsupported relationships, absent local evidence, partial external
resolution, and empty valid results. Preserve provenance explaining how each
result was reached.

Do not infer interests, people-versus-project identity, trust, quality, or
spam labels.

## Acceptance criteria

- An account handle can directly acquire or select its authored notes without
  caller-side ID extraction.
- A note handle can directly obtain bounded conversation and reference
  context.
- Local and external continuations share one typed command shape and clearly
  report completeness.
- Multi-subject expansion remains bounded and exposes per-input omissions.
- `explain` can show the traversal relationship responsible for membership.

## Verification

- Permanent tests expected: yes, one functional continuation scenario using
  deterministic in-memory Nostr events; protocol parsing rules may retain
  focused unit tests.
- Stable public behavior protected: typed handle input, relationship
  semantics, completeness and provenance.
- Temporary task validation or field evidence: one live account-to-authored-
  notes-to-conversation path with strict budgets.
- Explicitly excluded test levels or mechanisms: real relay tests in the
  permanent suite, socket lifecycle tests, tests per relationship.

## Reassessment after attempt 2

The completeness finding survived because local projections remained
hard-capped at the memory API's maximum query limit of 1,000. The bounded
strategy is:

- for `eventLimit < 1000`, project at `eventLimit + 1` so truncation is
  directly observable;
- at the absolute 1,000 ceiling, conservatively report the bound reached when
  the projection returns 1,000 because a 1,001st candidate cannot be queried;
- do not increase memory capacity/query limits or add another API merely to
  prove exhaustiveness.

Protect this boundary inside the existing single continuation functional
scenario. This is a clarified completeness rule, not a request to repeat the
unchanged hard-coded projection.


# Previous independent review

BLOCKED

The previous review’s substantive completeness finding remains after the worker attempt.

`packages/nostr-research/src/continuation.js:165-166, 200-215` still caps every local projection at 1,000 items. Since `eventLimit` may also be 1,000, `packages/nostr-research/src/continuation.js:52-61` cannot detect a 1,001st resident match and incorrectly reports the result as complete and exhaustive.

The functional scenario does not exercise this boundary. Per the review policy, this requires reassessment rather than a third mechanical change request.

# Worker report

Implemented the 1,000-item completeness boundary.

- Local projections request `eventLimit + 1` below 1,000.
- A projection returning 1,000 at the absolute ceiling conservatively reports `partial`, non-exhaustive, with `event-limit`.
- Expanded the existing continuation functional scenario to protect this stable completeness behavior.

Validation:

- Targeted continuation test passed.
- Full task validation passed: 26 tests passed, 15 network tests skipped because loopback listeners are sandbox-restricted.
- `git diff --check` passed.

Permanent tests expanded: the single public-boundary continuation scenario now covers typed handle input and conservative completeness at the memory query ceiling. Temporary validation cannot reliably protect this subtle stable boundary.

Unresolved uncertainties: live relay validation was not rerun in this sandbox.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/continuation.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check src/jsonl-session.js && node --check bin/nostr-research-console.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:30938) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (151.734208ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, and provenance (87.362583ms)
✔ account hydration derives a bounded metadata filter from account subjects (44.721792ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (47.978625ms)
✔ plan preflight rejects retention of value collections before acquisition starts (23.674833ms)
✔ global limit and cancellation are distinguishable (72.646416ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (78.7095ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (177.846333ms)
✔ timeout and partial connection failure remain observable (161.210125ms)
✔ acquisition rejects unusable public inputs before networking (0.431041ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.479375ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (115.749458ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (33.461375ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (111.541958ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (124.570375ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (73.663292ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (104.268167ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (39.885542ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.618625ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (10.037125ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.636208ms)
✔ stable bounds and compatible set composition share the public pipeline algebra (14.832209ms)
✔ pipeline schema exposes literal fields and preflight rejects invalid composition (3.593375ms)
✔ bounded groups preserve complete derived inputs and provenance for aggregation (10.254167ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (320.622167ms)
✔ named account and note handles continue with bounded relationship provenance (2235.46725ms)
✔ declarative observation and lifecycle form one bounded public workflow (40.010541ms)
✔ declarative show bounds grouped and summarized named results (3.55575ms)
✔ declarative named results compose compatible sets and expose their schema (2.2855ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (32.864ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (33.969ms)
✔ JSONL executable provides one persistent bounded process workflow (107.812583ms)
✔ process-local memory preserves canonical evidence and independent relay observations (33.529167ms)
✔ presentation and facets orient surviving research values (48.168666ms)
✔ replaceable selection and follow interpretation remain stable in one process (48.804041ms)
✔ public local search composes constraints, explains matches, and preserves provenance (30.187917ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (20.06325ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2301.518208ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (52.368042ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (37.601917ms)
✔ retained reactivation does not recreate evicted canonical evidence (7.683084ms)
ℹ tests 41
ℹ suites 0
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2527.167666


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.