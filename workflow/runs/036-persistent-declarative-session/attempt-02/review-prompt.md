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
id: 036-persistent-declarative-session
status: in_progress
max_attempts: 4
validation: workflow/tasks/036-persistent-declarative-session.validate.sh
depends_on: 035-plan-and-algebra-correctness
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Add the persistent declarative research session

## Objective

Create the in-process interpreter foundation which gives agents persistent,
named access to the existing declarative algebra without executing arbitrary
code.

This is not the JSONL adapter and not the observation/presentation task. It is
the reusable session and command protocol underneath those adapters.

## Shared operation execution

Deepen the current plan module so individual interpreter commands and named
plans use one normalized operation representation and one execution path.

- Extract or expose the smallest shared preflight/execution capability needed
  by both callers.
- Do not duplicate filter, group, summarize, move, acquisition, hydration, or
  retention semantics in the interpreter.
- Preserve complete preflight before external effects.
- Preserve existing valid named-plan behavior and reports.

## Interpreter-owned state

Add a focused module, preferably `src/interpreter.js`, which owns:

- one open bounded research memory supplied by its caller;
- engine-owned named result handles;
- a non-negative integer session revision;
- command validation and dispatch;
- active external-operation cancellation;
- close behavior.

Named result handles are not copied canonical datasets. Subject collections
remain stable subject/reason references whose evidence resolves through memory.
Typed group/summary results remain bounded engine-owned results.

A public handle reports only concise metadata:

```json
{"id":"authors","kind":"accounts","count":24,"revision":18}
```

Reject duplicate result IDs unless the command explicitly requests
replacement. Replacing or releasing a handle is interpreter-state mutation.

## Stable command envelope

Accept plain JSON commands containing:

- caller-owned non-empty `commandId`;
- optional non-negative `ifRevision`;
- `command`;
- command-specific plain-data fields.

Return exactly one plain-data response:

```json
{
  "ok": true,
  "commandId": "c17",
  "sessionRevision": 42,
  "result": {},
  "warnings": []
}
```

or:

```json
{
  "ok": false,
  "commandId": "c17",
  "sessionRevision": 42,
  "error": {
    "code": "UNKNOWN_RESULT",
    "message": "...",
    "details": {}
  }
}
```

Initial stable error codes:

- `INVALID_COMMAND`
- `INVALID_OPERATION`
- `UNKNOWN_RESULT`
- `DUPLICATE_RESULT`
- `INVALID_SUBJECT`
- `TYPE_MISMATCH`
- `REVISION_CONFLICT`
- `SESSION_CLOSED`
- `INTERNAL_ERROR`

Expected bounded relay/hydration incompleteness is not a command error.

## Initial research commands

Support the existing operation vocabulary:

- `acquire`
- `select`
- `filter`
- `group`
- `summarize`
- `move`
- `hydrate`
- `retain`
- complete named `plan`

Commands consuming results name their input handle. Result-producing commands
may supply a result ID. Plans expose selected stage outputs as handles without
changing plan-stage semantics.

## Revision invariant

- Successful commands increment revision once when they mutate corpus,
  retained memory state, or named handles.
- Read-only commands do not increment revision.
- A failed command leaves interpreter-owned state, memory, and revision
  unchanged.
- `ifRevision` conflicts fail before execution.
- An external operation which encountered bounded partial relay outcomes
  returns `ok: true` with structured completeness; it is not converted into an
  error.

Use preflight and the existing bounded external-operation reporting to uphold
the failed-command invariant. Do not create a corpus snapshot/rollback system.

## Boundaries

- No stdin/stdout, JSONL, browser adapter, UI, persistence, Rust, DSL, plugin,
  or automatic judgment.
- Do not add algebra operations.
- Do not merge this session with the JavaScript console's active-selection
  `ResearchSession`; they have different responsibilities.
- Do not expose arbitrary callbacks or executable strings.
- Add one public functional scenario covering command envelopes, handles,
  revision behavior, replacement, preflight failure, and partial external
  outcomes. Avoid per-command unit tests.

## Acceptance criteria

- Plans and interactive commands demonstrably share normalization/execution.
- Named handles persist across commands and do not duplicate canonical
  evidence ownership.
- Stable response envelopes and semantic error codes are returned.
- `ifRevision` and mutation-only revisions behave predictably.
- Failed commands leave memory, handles, and revision unchanged.
- Partial external outcomes are successful commands with structured status.
- No supplied executable code is accepted.
- Existing plan, algebra, console, and functional behavior remains intact.
- Functional tests and syntax checks pass.


# Worker report

Deliverables:
- Updated shared operation execution to treat empty typed hydration as a successful structured `no-account-subjects` outcome.
- Added the reviewed acquire → empty accounts → hydrate plan case to the public functional scenario.
- Preserved revision consistency after corpus mutation.

Validation:
- Full task validation passed.
- Syntax checks and `git diff --check` passed.
- 18 tests passed; 16 relay tests skipped because the sandbox forbids loopback listeners.
- Manually verified empty hydration performs no relay contact or corpus mutation.

Unresolved uncertainties:
- The loopback-dependent scenario requires review in an environment permitting local listeners.

# Validation output

Exit code: 0


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check bin/nostr-research-console.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:82690) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (179.592916ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (113.674541ms)
✔ account hydration derives a bounded metadata filter from account subjects (57.005375ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (55.948125ms)
✔ plan preflight rejects retention of value collections before acquisition starts (35.990791ms)
✔ global limit and cancellation are distinguishable and close owned sockets (279.206625ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (93.282208ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (69.020375ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (141.49975ms)
✔ timeout and partial connection failure remain observable (157.437417ms)
✔ acquisition rejects unusable public inputs before networking (0.383875ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.486541ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (138.3885ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (109.864333ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (68.791375ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (236.273958ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (128.216667ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (147.099375ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (52.628291ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.278167ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (13.778166ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.57ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (271.926708ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (45.683833ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (22.363292ms)
✔ process-local memory preserves canonical evidence and independent relay observations (50.622ms)
✔ presentation and facets orient surviving research values (39.960834ms)
✔ replaceable selection and follow interpretation remain stable in one process (52.817792ms)
✔ public local search composes constraints, explains matches, and preserves provenance (33.002042ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (31.315083ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2301.564709ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (28.578667ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (28.263ms)
✔ retained reactivation does not recreate evicted canonical evidence (5.753791ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10811.372625


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.