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
id: 018-bounded-inspection-and-orientation
status: in_progress
max_attempts: 5
validation: workflow/tasks/018-bounded-inspection-and-orientation.validate.sh
depends_on: 017-explicit-javascript-composition
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded inspection and transparent corpus orientation

## Reason

The console successfully supported an adaptive investigation, including
surviving a disconnected chat, but practical use exposed two recurring costs:
callers guessed different property names across acquisitions, collections,
subjects, and saved sets; and a collection containing only a few very long
notes could flood the terminal. The investigation also rebuilt author and tag
counts manually before it could see corpus domination or choose a direction.

These are inspectability problems. They do not justify automatic ranking,
classification, or a formal preference system.

## Objective

Provide one bounded inspection operation and one transparent facet operation
that help an agent or human understand a corpus before deciding what to do.

## Bounded inspection

Expose:

```js
research.show(value, options)
```

It must recognize at least:

- acquisitions and acquisition coverage;
- result collections;
- events and accounts;
- research sets and runs;
- workspace summaries; and
- session descriptions.

The returned inspection value should use a consistent presentation vocabulary
where meaningful:

```text
type, id, count, preview, context, provenance
```

It is a bounded semantic representation, not a mutation of the underlying
canonical object. Complete original values remain available to JavaScript.

Support small explicit controls such as preview limit, excerpt length, and
whether evidence details are included. Apply safe defaults and hard maximums.
Bound by approximate serialized size and text excerpt length, not only item
count.

Acquisition inspection must expose:

- exact filter and explicit bounds;
- relays contacted and outcome per relay;
- observation and distinct-event counts;
- invalid and duplicate counts where recorded;
- completion reason and operation budgets; and
- coverage uncertainty without claiming exhaustive relay indexing.

## Transparent facets

Expose:

```js
research.facets(collection, options)
```

For the supplied bounded collection, derive deterministic counts for:

- authors;
- tags;
- event kinds;
- observed relays;
- linked source domains; and
- presence of links, images, and videos.

Facets describe the supplied evidence; they are not global trends, quality
scores, or recommendations. Counts must not silently count repeated relay
observations as distinct events. Each facet includes enough identity to become
an explicit later selection.

Bound facet categories and return an explicit omitted count rather than an
unbounded map.

## Presentation consolidation

Clarify and document the responsibilities:

- memory projection provides compact or full semantic research projections;
- `research.show` provides bounded interactive inspection; and
- the REPL writer prevents accidental terminal flooding.

Consolidate duplicated size/excerpt rules where doing so reduces code. Do not
introduce a presentation framework or change canonical persistence shapes
merely to make every object structurally identical.

Inspect whether the in-memory workspace implementation forms a clean cohesive
module. Move it out of the main memory file only if that reduces coupling and
does not require exporting private persistence helpers or creating miniature
index classes. File splitting is not an acceptance criterion.

## Directed field trial

Conduct another real persistent-console investigation using:

- `show` and `facets` for initial orientation;
- `limitPer`, `exclude`, and ordinary JavaScript predicates for positive and
  negative direction;
- explicit follow, mention, and conversation pivots;
- at least two bounded public relays when available; and
- deliberate retention and reopen verification.

Use JavaScript variables for research orientation. Do not implement a lens
class. Record the trial in
`workflow/artifacts/second-console-field-trial.md`, including exact commands,
evidence-backed findings, output or shape friction, and no more than five
justified next tasks.

## Boundaries

- No UI or screenshots.
- No automatic spam, bot, trust, quality, or interestingness classifier.
- No recommendation score or machine-learned preference.
- No custom query language or saved-lens persistence.
- No default relays, background scanning, or unbounded crawling.
- No tests for formatter internals or every facet category.

## Verification

Use one public process-boundary functional scenario that:

- inspects every supported high-level value type without property guessing;
- proves a few very long notes remain bounded;
- calculates facets over events with repeated relay observations;
- uses a facet identity in a later explicit selection;
- applies positive and negative direction as ordinary JavaScript;
- retains and reopens the result; and
- confirms complete canonical evidence remains available outside `show`.

The reviewer must also operate the console interactively against a disposable
database and inspect the field-trial artifact.

## Acceptance criteria

- Common console values have one predictable bounded inspection route.
- Long output is bounded by size as well as item count.
- Facets transparently describe the supplied selection.
- Acquisition outcomes and uncertainty are inspectable.
- Projection, inspection, and REPL responsibilities are not duplicated
  unnecessarily.
- The second trial validates human-scale orientation without formalizing a
  research lens.
- Existing library, CLI, persistence, and console behavior remain usable.
