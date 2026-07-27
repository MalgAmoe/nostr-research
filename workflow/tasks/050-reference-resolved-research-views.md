---
id: 050-reference-resolved-research-views
status: ready
max_attempts: 5
validation: workflow/tasks/050-reference-resolved-research-views.validate.sh
depends_on: 049-research-notebook
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make collections and relations honest reference-resolved views

## Objective

Remove the accidental evidence archive inside research relations and handles
while preserving the composable operations that made the strict field trial
successful.

Views must remain useful for iterative research, but source evidence lifetime
must be controlled by the buffer and archive rather than undocumented row
copies.

## Work

- Inventory every value currently copied into subject collections, relations,
  acquisition/continuation reports, and session handles.
- Make stable subject references, operation context, ordering, bounded derived
  values, membership reasons, and provenance references the owned content of a
  view.
- Resolve source-backed event/profile fields through the authoritative
  archive/buffer resolver when an operation or projection needs them.
- Report source as `archive`, `buffer`, or `unresolved`; never preserve a stale
  `evidence.resident` value.
- Keep deliberate derived material bounded and visibly derived. In particular:
  - vocabulary scanning retains match field, term, source subject, and a
    bounded excerpt or match coordinates rather than an unlimited source
    field;
  - aggregation samples and collected values expose their truncation;
  - joins do not duplicate complete event/profile records.
- Define honest behavior when a later operation needs unavailable source
  fields: explicit omissions or a semantic unresolved-evidence error, not
  `INTERNAL_ERROR` and not silently stale data.
- Make `show` windows predictable. The returned effective offset/limit,
  size-bound truncation, omitted-before, and omitted-after must agree so the
  next window can be requested mechanically.
- Preserve the useful algebra (`filter`, `project`, `distinct`, `sort`,
  `limit`, `join`, `aggregate`, `derive`, `slice`, `explode`, `scan`,
  `balance`) unless live evidence shows a specific operation no longer earns
  its interface.
- Remove copied-evidence branches and tests rather than maintaining parallel
  relation formats.

## Acceptance criteria

- Ordinary relation and handle creation does not silently copy complete notes,
  profiles, tags, or observation records.
- Operations over resident or archived evidence retain their current practical
  composability.
- The same view clearly changes from buffer-backed to archive-backed or
  unresolved as evidence lifetime changes.
- Scan and aggregate outputs keep enough bounded evidence for judgment without
  becoming an unlimited source snapshot.
- Large and paginated `show` requests return bounded semantic results with
  reliable continuation metadata and no size-related `INTERNAL_ERROR`.
- Serialized view size is governed by selected subjects and bounded derived
  values, not accidental duplication of complete source events.

## Verification

- Permanent tests expected: yes, one public collection/relation functional
  scenario covering resolution changes, bounded scan evidence, joins, and
  deterministic window continuation.
- Stable public behavior protected: the composable relation algebra and
  bounded observation interface.
- Temporary task validation or field evidence: compare serialized sizes and
  behavior of an equivalent view before and after complete buffer turnover.
- Explicitly excluded test levels or mechanisms: snapshots of internal row
  shape, tests per algebra operation, private resolver tests, live relays,
  socket transport, UI, and compatibility tests for copied relation fields.
