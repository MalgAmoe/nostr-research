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

The product foundation is a UI-independent library. A CLI, functional
verification, and future user interfaces are consumers of that library; a UI
does not define the domain boundary. The current Solid application is a
behavioral reference during this work. Its code and observed behavior may be
retained, recreated, or rejected deliberately; neither its Solid controllers,
browser persistence, nor its present module layout is an implicit target
architecture.

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
| **acquisition** | The operation of contacting or otherwise reading sources to obtain events and record observations. |
| **query** | An operation over local memory that selects and explains results; it does not itself require relay access. |
| **research run** | One recorded execution of a research operation, with its inputs, outcomes, and time/context sufficient to interpret it. |
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
- which future UI workflows, if any, should consume the library.

The current application contains useful behavior in all of these areas, but it
does not settle them. In particular, its IndexedDB/localStorage persistence,
Solid state, hidden array metadata, relay cache policy, and editorial scoring
heuristics must not be copied into the library by default.


# Selected task

---
id: 006-query-and-navigate-memory
status: in_progress
max_attempts: 5
validation: workflow/tasks/006-query-and-navigate-memory.validate.sh
depends_on: 005-live-relay-acquisition
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Query and navigate accumulated research memory

## Objective

Make acquired evidence locally searchable and navigable through the public
library and CLI while preserving provenance and explaining why results match.

All behavior operates on accumulated SQLite memory. This task must not silently
contact relays.

## Required query behavior

Support composable local constraints for:

- event IDs and ID prefixes where unambiguous;
- author public keys and prefixes where unambiguous;
- event kinds;
- inclusive creation-time bounds;
- standard Nostr tag constraints such as `#e`, `#p`, and `#t`;
- case-insensitive text terms over note content;
- explicit result limit and deterministic ordering.

Define the semantics of combining constraints and multiple text terms.
Malformed or ambiguous constraints must produce useful errors rather than
silently broadening a query.

Each returned result must include:

- the canonical event;
- stored relay observations;
- explicit match reasons derived from the submitted constraints.

The library may introduce only the derived SQLite indexes needed for these
operations. Derived data must remain rebuildable from canonical raw events.

## Required account behavior

- Resolve stored kind-0 metadata events by public key using current
  replaceable-event semantics.
- Search stored account metadata by public-key prefix and profile fields such
  as `name`, `display_name`, and `nip05`.
- Preserve the source metadata event and observations.
- Report ambiguity or absence explicitly.

Do not introduce global identity confidence or trust scoring.

## Required navigation behavior

Extract observable relationships from stored events, including:

- author;
- reply root and direct parent where NIP-10 or NIP-22 evidence identifies them;
- quoted or mentioned events;
- mentioned accounts;
- topic and other tags.

Navigate both outbound relationships from an event and inbound stored events
that reference an event or account. Return only relationships supported by
stored evidence, with relationship type and source event IDs.

Protocol interpretation must distinguish known semantics from best-effort
fallbacks. Do not infer social affinity or interest.

## CLI behavior

Extend the existing CLI with discoverable commands for:

- local event search;
- stored-account search or inspection;
- related entities for an event or account.

Structured output must retain match reasons and provenance. Commands must not
require knowledge of SQLite tables.

## Scope boundaries

- Do not add relay acquisition to local-query commands.
- Do not add ranking, recommendations, moderation, saved research sets,
  research-run persistence, graph databases, or UI integration.
- Do not expose SQL as the public query interface.
- Do not create an in-memory implementation.

## Verification

- Use reproducible signed fixtures representing metadata, replies, mentions,
  quotes, tags, multiple authors, multiple relays, and absent references.
- Verify the complete behavior through the public library or CLI and a
  temporary real SQLite database.
- A small permanent unit test is acceptable only for protocol relationship
  interpretation that is sufficiently tricky and stable to justify freezing.
- Do not test SQL text, table layout, private helpers, or module boundaries.
- The independent reviewer must construct at least one fresh black-box
  navigation scenario rather than relying only on committed fixture assertions.

## Acceptance criteria

- Local queries never contact a relay.
- Query combinations are deterministic, bounded, and documented.
- Match reasons accurately describe every returned result.
- Account metadata resolution follows Nostr replaceable-event rules.
- Relationship direction and protocol evidence are visible to callers.
- Missing referenced entities do not break navigation and remain identifiable
  as unresolved references.
- Provenance survives search and navigation.
- Derived indexes can be recreated from raw stored events.
- CLI failures are useful and non-zero.
- Reference-client behavior and source remain unchanged.


# Latest independent review

CHANGES_REQUIRED

1. `packages/nostr-research/src/index.js:412-418` overwrites equivalent tag constraints such as `t` and `#t`. Values for one tag are documented to combine with OR, but `{t: ['alpha'], '#t': ['missing']}` incorrectly discards `alpha`. Merge normalized aliases or reject duplicates explicitly.

2. `packages/nostr-research/src/index.js:643-673` labels any event containing uppercase `E` plus unmarked `e` tags as known NIP-22 reply evidence, regardless of event kind. NIP-22 comment interpretation must be limited to applicable kind-1111 events; otherwise expose the relationship as fallback/general tag evidence.

3. `packages/nostr-research/src/index.js:586-601` considers an account resolved only when kind-0 metadata exists. In the fresh black-box scenario, even the canonical author relationship was marked unresolved despite stored events proving that account and `relatedAccount()` successfully navigating it. Account existence/resolution must reflect stored author/reference evidence separately from whether profile metadata is available.