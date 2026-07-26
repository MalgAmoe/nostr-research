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


# Latest independent review

CHANGES_REQUIRED

1. `sample` aggregations ignore their required `field`. In `packages/nostr-research/src/index.js`, `normalizeAggregation()` requires and validates `field`, but `aggregate()` returns complete items via `items.slice(...)` regardless of that field. Consequently, documented plans such as `field: 'subject'` and `field: 'event.text'` produce identical results, and the functional test never verifies the sampled value. Make the operation’s behavior match its declared JSON description—either return bounded values from the requested field or remove the field from the public contract and documentation—and add a public-boundary assertion covering the result.