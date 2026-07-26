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
id: 038-jsonl-session-field-trial
status: in_progress
max_attempts: 4
validation: workflow/tasks/038-jsonl-session-field-trial.validate.sh
depends_on: 037-bounded-session-observation
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Add the JSONL adapter and prove it through live research

## Objective

Expose the persistent declarative session as a protocol-clean JSON Lines
process and use it for open-ended live Nostr research without dynamically
authoring JavaScript.

The reusable architecture is the command/response protocol. JSONL is the first
adapter only.

## Executable adapter

Add a package executable such as:

```text
nostr-research-session --capacity 500
```

It must:

- read UTF-8 input one line at a time;
- parse one JSON command per non-empty line;
- dispatch commands sequentially to one persistent declarative session;
- write exactly one single-line JSON response per command to stdout;
- keep stdout free of prompts, progress prose, stack traces, and logs;
- turn malformed JSON into an `INVALID_COMMAND` response when correlation is
  unavailable;
- keep optional human diagnostics on stderr only;
- cancel owned external operations and close memory on EOF, signal, or process
  termination.

Do not duplicate command or research semantics in the adapter.

## Process-boundary functional scenario

Spawn the real executable and verify through JSONL that:

- memory and handles persist across commands;
- response envelopes remain valid one-line JSON;
- command IDs are echoed;
- revisions change only on mutations;
- unknown handles and revision conflicts are stable errors;
- bounded show/inspect/explain output works;
- release and reset semantics are correct;
- EOF closes cleanly.

Keep this as one functional process workflow, not a test per command.

## Live no-JavaScript trials

Use the executable itself—not a JavaScript wrapper—to perform at least three
different live investigations:

1. one directed topical/account investigation;
2. one orientation-first investigation where a later command is chosen after
   inspecting bounded evidence;
3. one investigation which encounters missing, empty, partial, or relay-error
   evidence and changes direction.

All research operations must be JSON commands sent to the process. Shell
transport may feed JSONL, but no dynamically authored JavaScript, callbacks,
manual reductions, or library imports may perform research work.

Record the exact JSONL command/response transcript or a bounded faithful
transcript with hashes/paths to any oversized raw capture in:

`workflow/artifacts/declarative-session-field-trials.md`

Record:

- whether any dynamic JavaScript was still needed;
- usability for an agent compared with the JavaScript REPL;
- output sizes and omitted/truncated values;
- useful and useless warnings;
- revision behavior;
- external completeness behavior;
- missing neutral operations, if any;
- presentation or protocol friction;
- what should be removed or simplified.

## Cleanup and documentation

Make only corrections directly evidenced by the process trial. Remove
redundant session/protocol surface rather than retaining speculative options.
Document the executable, protocol envelope, commands, and bounded output.

Do not remove the JavaScript REPL in this task. The trial decides whether it
can later be deprecated or removed.

## Boundaries

- No browser adapter, Worker adapter, server, UI, Rust, persistence, DSL,
  plugin system, concurrency scheduler, or automatic classification.
- Do not add algebra operations merely to make a trial look successful.
- Do not implement multi-client concurrency beyond optional `ifRevision`.
- The live transcript is validation evidence, not a permanent network test.

## Acceptance criteria

- The real executable is a persistent protocol-clean JSONL process.
- It uses the same interpreter and operation semantics as in-process callers.
- The process functional scenario passes.
- Three live investigations are recorded and use no dynamic JavaScript for
  research.
- Responses remain bounded, correlated, revisioned, and machine-readable.
- Partial and empty outcomes remain successful, structurally explicit
  research results where appropriate.
- The artifact gives an evidence-based verdict on replacing the JavaScript
  REPL's practical role.
- Functional tests and syntax checks pass.


# Worker report

Implemented the signal-shutdown fix.

- Changed `acquire.js` to track the underlying TLS transport and await its actual closure before completing cancellation.
- Prevented the early WebSocket `close` event during handshake cancellation from prematurely completing session shutdown.
- Ran the complete task validation, syntax checks, full test suite, and `git diff --check`; all available checks passed.
- 21 tests passed; 17 network tests were skipped because this sandbox forbids loopback listeners.

Unresolved uncertainty: the exact relay-socket signal test could not execute under the sandbox’s loopback restriction, though the reviewed transport lifecycle race is now directly addressed.

# Validation output

Exit code: 1


> nostr-research@0.1.0 check
> npm run check --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 check
> node --check src/index.js && node --check src/acquire.js && node --check src/plan.js && node --check src/interpreter.js && node --check src/expansion.js && node --check src/reply-contexts.js && node --check src/session.js && node --check src/presentation.js && node --check src/console.js && node --check src/jsonl-session.js && node --check bin/nostr-research-console.js && node --check bin/nostr-research-session.js


> nostr-research@0.1.0 test
> npm test --workspace packages/nostr-research


> @nostr-research/memory@0.1.0 test
> node --test

(node:94352) Warning: Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0' makes TLS connections and HTTPS requests insecure by disabling certificate verification.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ declarative session preserves handles, revisions, preflight, and partial outcomes (135.584959ms)
✔ public acquisition handles NIP-01 outcomes, validation, deduplication, provenance, and closure (116.110292ms)
✔ account hydration derives a bounded metadata filter from account subjects (81.005584ms)
✔ a named public plan composes bounded acquisition, algebra, hydration, and retention (82.435ms)
✔ plan preflight rejects retention of value collections before acquisition starts (45.137542ms)
✔ global limit and cancellation are distinguishable and close owned sockets (151.485417ms)
✔ distinct-event budget ignores duplicate observations while observation budget stays hard (252.239916ms)
✔ canonical relay events outside the requested filter are diagnosed without ingestion (27.070834ms)
✔ timeout force-closes a peer that ignores the WebSocket closing handshake (156.450083ms)
✔ timeout and partial connection failure remain observable (141.675917ms)
✔ acquisition rejects unusable public inputs before networking (0.411875ms)
✔ console expansion rejects invalid bounds and semantics before networking (0.482667ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100, authored-note limit 2 per starting account...
Expansion completed: 3 request(s), 6 accepted observation(s), 6 distinct event(s), 7 resident event(s).
✔ authored-note expansion samples only explicit account starts within per-account and global bounds (89.260833ms)
✔ authored-note expansion obeys the complete operation budget and stays disabled by default (46.162375ms)
✔ expansion reuses distinct capacity when a later request repeats an earlier event (131.044334ms)
Resolving reply contexts through 2 relay(s), authored limit 6, parent limit 2...
Reply contexts completed: 5 reply/replies, 2 unresolved parent(s), 7 accepted observation(s), 7 distinct event(s).
✔ bounded reply contexts resolve direct NIP-10 parents with provenance and explicit gaps (136.431208ms)
Expanding through 2 relay(s), depth 2, observation limit 10, distinct-event limit 100...
Expansion completed: 6 request(s), 4 accepted observation(s), 4 distinct event(s), 5 resident event(s).
✔ console expansion performs bounded targeted multi-hop acquisition (58.865959ms)
✔ exported expansion uses the global budget for reply breadth and preserves tiny-corpus seeds (96.379625ms)
✔ typed local stages refine, balance, summarize, and move trial-shaped evidence (45.626084ms)
✔ empty paths retain typed context and invalid plans fail before execution (0.273209ms)
✔ bounded groups expose exact membership, refresh evidence, and summarize exact counts (15.035167ms)
✔ a local-only named plan can query resident memory without implicit acquisition (0.559166ms)
✔ one console process preserves JavaScript state and composes a bounded research loop (307.805917ms)
✔ declarative observation and lifecycle form one bounded public workflow (33.805958ms)
✔ declarative show bounds grouped and summarized named results (2.1255ms)
✔ mixed ingestion and FIFO eviction leave coherent public indexes and source edges (35.080333ms)
✔ collections re-resolve stable subjects across observations, replacement metadata, and eviction (39.102041ms)
✔ JSONL executable provides one persistent bounded process workflow (78.760542ms)
✖ JSONL executable cancels active external work on a termination signal (2083.830375ms)
✔ process-local memory preserves canonical evidence and independent relay observations (29.13525ms)
✔ presentation and facets orient surviving research values (45.308083ms)
✔ replaceable selection and follow interpretation remain stable in one process (62.021708ms)
✔ public local search composes constraints, explains matches, and preserves provenance (28.032208ms)
✔ current account metadata uses replaceable semantics and profile search returns source evidence (19.667541ms)
✔ large retention is atomic, bounded, process-local, and directly navigable (2225.013458ms)
✔ selection, bounded traversal, projection, retention, and continuation compose (31.532041ms)
✔ a session only changes active selection explicitly and checkpoints it process-locally (32.812167ms)
✔ retained reactivation does not recreate evicted canonical evidence (6.600125ms)
ℹ tests 38
ℹ suites 0
ℹ pass 37
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10727.579334

✖ failing tests:

test at test/jsonl-session.functional.test.js:113:1
✖ JSONL executable cancels active external work on a termination signal (2083.830375ms)
  Error: session closure left the relay socket open
      at Timeout.<anonymous> (file:///Users/malg/Documents/Codex/nostr/packages/nostr-research/test/jsonl-session.functional.test.js:181:43)
      at listOnTimeout (node:internal/timers:605:17)
      at process.processTimers (node:internal/timers:541:7)
npm error Lifecycle script `test` failed with error:
npm error code 1
npm error path /Users/malg/Documents/Codex/nostr/packages/nostr-research
npm error workspace @nostr-research/memory@0.1.0
npm error location /Users/malg/Documents/Codex/nostr/packages/nostr-research
npm error command failed
npm error command sh -c node --test


# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.