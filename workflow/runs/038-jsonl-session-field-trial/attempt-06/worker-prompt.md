# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.
Do not stage or commit changes; the runner owns the task commit after review.

If a previous review is supplied, address every applicable finding explicitly.
Do not merely describe work that should be done: perform the task within its
stated permissions.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
- unresolved uncertainties.


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
max_attempts: 6
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


# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/acquire.js` does not reliably close the owned relay socket during signal termination. The process test `JSONL executable cancels active external work on a termination signal` fails with `session closure left the relay socket open`. Fix cancellation so the peer observes closure, then rerun the full validation with all functional tests passing.