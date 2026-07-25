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

- SQLite is the one real storage path for the library, CLI, functional
  verification, and future applications. Do not introduce an in-memory store
  as a production or functional-test substitute.
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
- Experimental databases are disposable and regenerable. During this phase
  there is no compatibility or migration burden for database formats.

## Shared terms

| Term | Meaning |
| --- | --- |
| **event** | A raw, valid Nostr event: immutable source evidence. |
| **observation** | A record that evidence was encountered through a particular acquisition context, such as a relay and its outcome. |
| **memory** | The local SQLite-backed research record of evidence, observations, and replaceable derived material. |
| **workspace** | A bounded, disposable in-process corpus of stored evidence with private indexes for repeated selection and relationship traversal; it is attached to memory and is not a persistence implementation. |
| **session** | A temporary, in-process research playground coordinating selection, focus, provisional exclusions, branches, and meaningful actions over memory. |
| **selection** | The session's replaceable result collection: the subjects currently being explored, with reasons and provenance where available. |
| **focus** | An optional subject receiving attention in a session; it is independent of and does not rewrite the selection. |
| **temporary branch** | A session-local named snapshot of selection, focus, and exclusions used to revisit an exploratory path; it is not durable evidence. |
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **acquisition coverage** | A durable record of one bounded relay attempt: exact filter and budgets, contacted relays and outcomes, and observations. It does not claim exhaustive indexing. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One durable recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it; unlike a session, it is an immutable operation snapshot. |
| **research set** | A deliberately saved, named or otherwise identifiable group of evidence for later inspection or expansion. |
| **provenance** | Observable source and acquisition history for evidence, including the context needed to assess it. |
| **derived relationship** | A reproducible interpretation connecting evidence (for example reply, mention, tag, author, or citation); it is not raw evidence and can be replaced. |

## Testing policy

- Permanent unit tests are reserved for difficult, stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing.
- Functional tests exercise public library or CLI boundaries with real SQLite.
- There is no automatic requirement to add a test for every feature or bug.
- Tests must not import private helpers or freeze internal architecture.
- Task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests.
- When network behavior is under review, live relay checks are task validation,
  not an always-on brittle test suite.

## Deliberately open decisions

These principles settle the direction, not a final public API, permanent
database schema, ranking method, or user interface. Product and design work
must still decide, through evidence and experimentation where appropriate:

- the reliability, cancellation, retry, and partial-result contract for
  multi-relay acquisition;
- event-validation and trust boundaries, including signatures and external
  identity claims;
- the durable provenance detail and research-run/set semantics;
- relay metadata, planning, configuration, moderation, and persistence policy;
- which current protocol interpretations are normative and which analysis or
  account-search heuristics are optional or excluded;
- pagination, corpus, portability, telemetry, and relationship semantics; and
- which future adapters, if any, should consume the library.

## Playground boundaries

A workspace is a bounded temporary corpus rebuilt from caller-selected durable
evidence. It accelerates repeated local selection and traversal but does not
replace memory or make evicted evidence less durable. A session coordinates
selection, focus, exclusions, history, and temporary branches over memory
operations or their workspace equivalents. A result collection is the shared
operation result passed between these layers. A research set is the explicit
durable checkpoint of chosen subjects and reasons; a research run is a durable
account of an operation. Neither a workspace, a session, nor session branches
are serialized as a whole.

Local selection asks what the current SQLite memory contains and has no network
side effects. Relay acquisition is separately invoked by a caller, may add
evidence and observations, returns the same reusable result vocabulary, and
records bounded acquisition coverage. Coverage says that a precise
relay/filter/budget attempt occurred. It never says that the relay or time
window was exhaustively indexed.

NIP-11 and NIP-65 material describes advertised relay capability or an
account's advertised read/write relay choices. These claims remain attributed
evidence. Per-relay acquisition outcomes are observed behavior, and the
library does not silently turn either advertised claims or observations into a
relay quality, trust, or fallback score.


# Selected task

---
id: 017-explicit-javascript-composition
status: in_progress
max_attempts: 5
validation: workflow/tasks/017-explicit-javascript-composition.validate.sh
depends_on: 016-protocol-correct-account-relationships
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Simplify explicit JavaScript composition

## Reason

The console field trial proved that ordinary JavaScript is the right
experimental interaction language. It also exposed avoidable ceremony:
traversal required mutating the current session selection, manually filtered
arrays had to be wrapped in a remembered result-collection envelope, and
common transparent reductions repeatedly reimplemented that envelope.

The solution is a few small functional operations, not a fluent query system
or a formal research-lens abstraction.

## Objective

Make explicit values the primary composable path while retaining session state
as an optional interactive convenience.

## Explicit and session traversal

Support both forms through the prepared console object:

```js
research.traverse(selection, options)
research.traverse(options)
```

The first form must not mutate session selection. The second continues from
the session's current selection and may update it according to the existing
interactive behavior. Ambiguous or invalid argument shapes must fail clearly.

Apply the same principle to `research.follows`: explicit account input is
required, and obtaining follows must not silently replace the current
selection.

## Collection construction

Expose one safe public constructor:

```js
research.collection(items, context)
```

It must validate and normalize through the established shared result
vocabulary. Callers should not need to remember `{ type, items, context }`.
It must not admit fabricated canonical evidence: stored subjects and embedded
records follow the workspace/memory integrity rules established in task 013.

## Minimal transformations

Add only the operations repeatedly needed in real console research:

```js
research.exclude(collection, predicate)
research.distinctBy(collection, selector)
research.limitPer(collection, selector, limit)
research.discoveries(collection)
```

They must:

- accept shared result collections or values already adaptable by the library;
- return ordinary shared result collections;
- preserve subject roles, reasons, provenance, records, and source context;
- preserve deterministic input order;
- validate callback and numeric arguments;
- avoid mutating inputs or session state; and
- add concise transformation context without embedding complete prior results.

`distinctBy` keeps the first item for each selector key.
`limitPer` keeps at most the requested number for each selector key.
`discoveries` selects items whose role is `discovery`.

## Session simplification

Do not move facets, preference learning, ranking, acquisition policy, or
durable query definitions into `ResearchSession`. The session remains focused
on temporary selection, focus, branches, exclusions, and deliberate
checkpoints.

If the implementation reveals console pass-through wrappers that only
duplicate an established public operation, consolidate them within this task.
Do not remove useful direct access to `memory`, `workspace`, or `session`.

## Boundaries

- No fluent collection class or chained query DSL.
- No lens, recommendation, spam, trust, or relevance abstraction.
- No monkey-patching arrays or public mutable internal maps.
- No UI, service API, worker protocol, or storage abstraction.
- Do not add one test per transformation helper.

## Documentation

Show one concise JavaScript sequence that:

- starts with an explicit collection;
- limits dominance per author;
- excludes an unwanted account;
- traverses without mutating the session;
- keeps discoveries; and
- deliberately moves the final result into the session or retention.

## Verification

Use one process-boundary console scenario over realistic stored evidence. In
the same process:

- create and reuse named JavaScript values;
- construct a collection from selected items;
- apply every transformation;
- compare explicit traversal with session traversal;
- prove explicit operations leave session selection unchanged;
- retain a transformed collection and reopen it from SQLite; and
- verify reasons and provenance survived.

Keep permanent verification at this public functional boundary.

## Acceptance criteria

- Explicit composition no longer requires incidental session mutation.
- Manual JavaScript selections can safely re-enter the result vocabulary.
- The four transformations are deterministic and provenance-preserving.
- Sessions remain small and optional.
- Existing library, CLI, and console workflows remain usable.


# Latest independent review

CHANGES_REQUIRED

1. `ResearchMemory.collection()` does not fully enforce embedded-record integrity. `#assertStoredRecord()` compares only the embedded event, so callers can supply fabricated `record.observations`, account `record.profile`, or other record fields alongside a genuine stored event. Validate the complete embedded record against the canonical record derived from SQLite, and extend the functional scenario to prove altered record metadata/provenance is rejected.