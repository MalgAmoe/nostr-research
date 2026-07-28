---
id: 072-truthful-relation-accounting
status: done
max_attempts: 4
validation: workflow/tasks/072-truthful-relation-accounting.validate.sh
depends_on:
---

# Truthful relation cardinality and bound accounting

## Context

A sustained CLI trial exposed a real honesty defect in intermediate relation
handles. Two input events with 160 total tags, exploded with the default limit
of 100, produce a 100-row handle whose current metadata says:

```text
inputCount: 2
outputCount: 100
omittedCount: 0
coverage.partial: false
```

The generic formula `max(0, input rows - output rows)` is not meaningful for
operations that expand, collapse, deduplicate, filter, join, or window rows.
The engine records the configured limit but can lose the fact that an
operation stopped because of it.

## Goal

Every relation stage must expose factual cardinality and limit information
whose units and meaning remain correct for that operation.

## Work

1. Remove the executor's generic derivation of semantic `omittedCount` from
   input and output row counts.
2. Keep a small common accounting core with explicit row units:
   - input rows;
   - output rows;
   - the applicable output limit, when one exists;
   - whether an additional qualifying output was observed beyond that limit.
3. Set `truncated: true` only when the operation knows that at least one
   qualifying output was not retained. Output count equalling the limit is not
   by itself proof of truncation.
4. Report an exact omitted-by-limit count only when the operation already
   knows it without inventing or conflating facts. It is acceptable to report
   known truncation without an exact omitted count.
5. Let each relation operation supply only the additional accounting that
   accurately describes its semantics:
   - predicate rejection is distinct from limit truncation;
   - duplicate removal is distinct from limit truncation;
   - aggregation reports produced/retained groups rather than treating row
     collapse as omission;
   - slicing reports its source total and selected window;
   - balancing reports per-key rejection separately from a global bound;
   - expanding operations such as explode, scan, and join detect an additional
     qualifying output rather than silently returning at the bound.
6. Preserve this accounting through relation context, handle storage,
   contextual schema where applicable, and `show summary` / `show coverage`.
7. Keep the implementation direct. Do not introduce a validation language,
   generic metrics framework, alternate executor, or operation hierarchy.
8. Update durable package documentation only where the public accounting
   contract changes.

## Acceptance criteria

- An explode with 160 possible rows and limit 100 reports 100 output rows and
  `truncated: true`.
- An operation producing exactly its limit with no additional candidate does
  not claim truncation.
- Filtering rejected rows is not mislabeled as bound omission.
- Aggregation row collapse is not mislabeled as omission.
- Window, deduplication, balancing, expansion, and join accounting use factual
  operation-specific meanings.
- Immediate handle metadata remains concise; bounded facts are observable
  through the existing session and presentation boundary.
- Plans and individual commands still use the same executor.
- Existing commands and composition remain compatible unless an old field was
  actively false; any such correction is documented explicitly.

## Non-goals

- Uniform summaries across every handle kind; that is Task 073.
- Relay transport changes.
- Exact total expansion counts when the engine would otherwise stop early.
- New research operations or task-specific shortcuts.
- Raising relation or memory limits.

## Verification

- Permanent tests expected: yes, by extending the existing public relation
  functional coverage rather than adding operation-by-operation unit tests.
- Stable public behavior protected: truthful expansion truncation, a
  non-truncated exact-limit case, filter semantics, aggregate semantics, and
  observation of the accounting through a named session handle.
- Temporary task validation or field evidence: reproduce the two-event,
  160-tag, default-limit case through the public session.
- Explicitly excluded test levels or mechanisms: private-helper imports,
  snapshots of entire response objects, live relays, browser automation, and a
  separate test for every relation operation.
