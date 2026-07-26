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


# Latest independent review

BLOCKED

The required fresh live Nostr field trial could not be completed because relay DNS/network access was unavailable. The artifact explicitly records only connection failures and substitutes controlled fixture evidence, so the live-field-trial acceptance criterion remains unverified.

The implementation and automated validation pass, but completion requires network access to execute and document the full plan against live relay evidence.