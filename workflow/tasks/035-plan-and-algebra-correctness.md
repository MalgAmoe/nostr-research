---
id: 035-plan-and-algebra-correctness
status: done
max_attempts: 4
validation: workflow/tasks/035-plan-and-algebra-correctness.validate.sh
depends_on: 034-named-research-plans-field-trial
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Correct plan preflight and algebra result semantics

## Objective

Fix the correctness and coherence issues found in the root review of the
stable-collection, collection-algebra, and named-plan milestone. Keep the
existing vocabulary and simple architecture.

## Complete plan preflight

Before executing the first stage, validate the complete plan:

- operation parameters;
- named input dependencies;
- input and output result kinds;
- every local filter/group/summarize/move description;
- acquisition, selection, hydration, and retention requirements.

No acquisition, hydration, retention, or other memory mutation may occur when
any later stage is statically invalid. Validation must use the same
normalization rules as execution rather than duplicating an approximate plan
schema.

## Select dependency semantics

Remove misleading arbitrary input dataflow for `select`.

A named-plan `select` either:

- has no input and explicitly queries the current resident corpus; or
- names an earlier acquisition stage solely as an ordering dependency.

Reject select inputs whose result kind is not an acquisition report. Document
that selection queries the authoritative current corpus and is not scoped to
the acquisition report's event IDs.

Do not add implicit activation or acquisition-scoped selection.

## Fresh typed collections

When a reusable typed group collection is accepted after the corpus changes,
re-resolve each group member from stable subject identity before filtering,
summarizing, projecting, or otherwise using its evidence. Preserve applicable
reasons and merge current canonical provenance exactly as ordinary result
collections do.

Summaries contain values rather than subjects and may remain immutable
plain-data results.

## Honest aggregation output

- Reject duplicate normalized aggregation names before execution.
- A bounded group must distinguish its complete input membership count from
  the number of member items retained under `itemLimit`.
- Expose explicit omitted/truncated information when members were discarded.
- `count` over a group must have unambiguous semantics. Prefer an exact total
  count for the group; if a separate retained-member count is useful, name it
  explicitly rather than silently changing `count`.
- Preserve bounded member storage and representative sampling.

## Boundaries

- Do not add algebra operations, a DSL, graph runtime, persistence, UI, Rust,
  or automatic judgment.
- Do not create a generic schema framework or adapter seam.
- Keep stable-subject resolution and provenance rules in one locality.
- Preserve the rule that arbitrary callers cannot fabricate canonical records
  or provenance through `memory.collection()`.
- Add focused functional scenarios at the public transform and plan seams.
  Do not add unit tests for normalization helpers or every predicate.

## Acceptance criteria

- A plan with an early acquire/retain and a later invalid stage fails before
  networking or memory mutation.
- Select dependencies are limited to acquisition ordering dependencies and are
  documented honestly.
- Grouped evidence refreshed after additional observations or replacement
  metadata is current when reused.
- Duplicate aggregation names fail clearly before execution.
- Bounded groups report exact total membership and omitted members; summary
  counts do not silently undercount.
- Existing valid live-trial-shaped plans remain supported.
- Functional tests and syntax checks pass.
