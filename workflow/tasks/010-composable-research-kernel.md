---
id: 010-composable-research-kernel
status: ready
max_attempts: 5
validation: workflow/tasks/010-composable-research-kernel.validate.sh
depends_on: 009-field-trial
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make account and conversation research composable

## Objective

Turn the field-trial friction into one coherent research kernel rather than a
collection of specialized workflows.

A caller should be able to resolve subjects, select or acquire evidence,
traverse explicit relationships, project useful representations, and retain
the resulting selection. Account research, conversation research, participant
discovery, and saved-research continuation must be compositions of these
shared operations.

The intended vocabulary is:

```text
resolve -> select/acquire -> traverse -> project -> retain
```

These are capabilities, not a mandated class hierarchy. Prefer the smallest
plain JavaScript design that makes the operations and data flow explicit.

## Architectural constraint

This task must not introduce a separate storage model, relationship engine,
result collection, or formatter for each convenience workflow.

- Events, accounts, tags, sets, and recorded runs are addressable subjects.
- Selection describes bounded evidence constraints.
- Traversal accepts subjects, relationship types, direction, depth, and limits.
- Projection renders shared results as compact, full, IDs, or NDJSON.
- Retention saves selected results with reasons and provenance.

Existing public operations may be adapted behind this vocabulary. Do not
duplicate them merely to satisfy new names. If complete unification would make
the API less clear, document the narrow boundary instead of building an
abstraction framework.

## Shared subjects and result collections

Define minimal public representations for subject references and reusable
research results.

- Subject references carry a type and stable identifier.
- A result collection preserves selected subjects plus the provenance or
  relationship evidence needed to explain them.
- Results from selection and traversal can be projected or retained without
  command-specific conversion and without reparsing rendered output.
- Existing event, account, run, and set identifiers remain stable.

Do not replace canonical stored Nostr events with summary objects. Projections
are views over evidence, not a second source of truth.

## Reusable selection

Expose one clear library-level selection operation for accumulated local
evidence. It must cover the existing useful constraints: identifiers, authors,
kinds, time bounds, exact tags, text, ordering, and limit.

Relay acquisition remains a distinct side-effecting operation because NIP-01
filters and relay outcomes matter. Reuse the overlapping selection vocabulary
where semantics truly match, but do not pretend local text search is a relay
filter or erase relay-specific fields.

Both operations must return reusable results rather than only rendered CLI
payloads.

## General traversal

Provide one library traversal operation over stored relationships with:

- one or more starting subjects;
- explicit relationship types;
- `inbound`, `outbound`, or `both` direction;
- bounded depth and maximum distinct results;
- deterministic order;
- edge evidence and interpretation retained in the result.

The same operation must support at least:

- event to direct replies and descendants;
- event to author, mentioned accounts, and topics;
- account to authored events and references;
- a collection of events to their participant accounts;
- expansion of saved research.

Cycles and duplicate paths must be bounded and deduplicated without losing an
explanation of how a retained subject was reached.

Ambiguous NIP-10 fallback edges must remain visibly different from known
marker-based relationships. Do not silently promote an unmarked `e` tag to a
definite reply.

Adapt existing `related event`, `related account`, and set expansion to use the
shared traversal behavior. Their public compatibility may remain as thin
conveniences.

## Shared projections

Replace command-specific compact shaping with shared projections over subjects
and result collections.

Useful compact projections must include:

- account: key, stored name/display name, NIP-05 when available, description
  excerpt, metadata event ID, and observed relays;
- event: ID, kind, author identity when known, creation time, bounded content
  excerpt, and observed relay count or names;
- set: identity, counts, and a bounded preview of member summaries;
- run: identity, operation, status, exact bounds/filter where recorded,
  outcome counts, and a bounded result preview;
- relationship/traversal: source and target summaries, direction, type, depth,
  and concise protocol interpretation.

`compact` must enable the next research choice without dumping complete signed
events. `full` remains the evidence representation. `ids` and `ndjson` remain
deterministic and composable. Provide a small explicit preview/excerpt limit
where needed; do not introduce terminal-width behavior, tables, or colors.

## Thin composed workflows

Add a focused conversation/thread operation as a composition of selection,
traversal, and projection. It should distinguish:

- the starting event;
- known ancestors when locally available;
- direct replies;
- deeper descendants;
- participating accounts;
- ambiguous references.

It must not implement another relationship parser or thread store.

Make the existing pieces sufficient for an account investigation:

1. resolve an account from stored name, NIP-05, key, or unambiguous prefix;
2. acquire metadata/recent events with the existing bounded acquisition API;
3. select authored evidence;
4. traverse mentions, replies, topics, or participants;
5. retain any resulting collection as a set;
6. reopen the database and continue from the retained set.

Convenience CLI commands are allowed only as thin translations into the shared
library operations. The library API is authoritative and must be usable
without invoking or parsing the CLI.

## Acquisition feedback

Project recorded or immediate acquisition results concisely with:

- exact relays and filter including explicit time bounds when supplied;
- per-relay EOSE, timeout, failure, or limit outcome;
- received, accepted, invalid, duplicate, observation, and newly stored counts;
- overall completion reason and recorded run ID;
- bounded result preview.

Do not change relay networking semantics in this task.

## Documentation

Update the package README with:

- the shared research vocabulary;
- one library example composing selection, traversal, projection, and
  retention;
- one CLI account-to-conversation investigation;
- the distinction between local selection and relay acquisition;
- how ambiguous protocol evidence is represented.

Keep documentation focused on public operations rather than internal module
structure.

## Scope boundaries

- Do not change the reference client.
- Do not add UI integration, ranking, recommendations, trust scores, social
  graph classification, moderation, or relay selection policy.
- Do not add an ORM, dependency-injection container, general graph framework,
  serializer framework, or command bus.
- Do not create separate account-research or thread-research databases.
- Do not add compatibility code for obsolete experimental sessions.
- Do not redesign the SQLite schema unless a small migration is demonstrably
  required for shared provenance; prefer existing tables.
- Do not create a unit test for each helper, projection, or CLI command.

## Verification

Keep permanent verification at meaningful boundaries:

- protocol-focused coverage for NIP-10 known versus ambiguous relationship
  interpretation and bounded cyclic traversal;
- one library-level functional scenario that composes local selection,
  multi-step traversal, projection, retention, close/reopen, and continuation;
- one black-box CLI scenario demonstrating useful compact account, set, and
  thread output while full evidence remains available.

The reviewer must independently use a disposable fixture-backed SQLite
database through the public library API, not only the CLI. The reviewer must
demonstrate two different research paths using the same selection and
traversal operations. Live relay access is optional because acquisition
networking is not being changed.

## Acceptance criteria

- The public library exposes reusable subject, selection, traversal,
  projection, and retention operations.
- Search, existing related operations, saved-set expansion, and the new thread
  workflow share those operations instead of parallel implementations.
- A result can flow from selection to traversal to projection to retention
  without parsing serialized CLI output.
- Thread output separates direct, descendant, ancestor, participant, and
  ambiguous relationships using retained protocol evidence.
- Compact account and set inspection provide enough information to choose a
  next operation; full mode preserves canonical evidence.
- Acquisition summaries expose exact request bounds and relay outcomes without
  flooding output.
- A retained selection can be reopened and continued through the same public
  operations.
- The implementation stays plain, cohesive, and materially easier to compose
  than adding more command-specific functions.
- Reference-client behavior and source remain unchanged.
- Permanent tests remain few, boundary-focused, and do not force unnecessary
  production helpers to stay public.

