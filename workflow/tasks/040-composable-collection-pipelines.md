---
id: 040-composable-collection-pipelines
status: ready
max_attempts: 4
validation: workflow/tasks/040-composable-collection-pipelines.validate.sh
depends_on: 039-scoped-working-buffers
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add one coherent collection composition pipeline

## Objective

Replace the most useful ad hoc JavaScript reductions with a small, typed,
plain-data composition pipeline that operates uniformly on scoped buffers and
named results.

This is one dataflow facility, not a separate command for every operation.

## Work

Extend the normalized collection operation representation to compose:

- nested `all`, `any`, and `not` predicates;
- explicit projection and distinct values;
- stable sorting, global limits, per-group limits, and bounded sampling;
- grouping and named aggregation;
- union, intersection, and difference of compatible subject collections;
- comparison of compatible named results.

Preserve stable subject identity, reasons, provenance, type checking, bounds,
and omission metadata through composition. Define deterministic behavior where
ordering affects a result.

Keep field semantics literal and discoverable. In particular, `name` and
`display_name` must remain distinct fields; do not silently coalesce them.

Do not add arbitrary callbacks, expressions, JavaScript evaluation, a textual
DSL, joins to external data, or universal quality classifications.

## Acceptance criteria

- The same normalized pipeline runs from plans, the in-process session, and
  JSONL commands.
- Pipelines can express the positive/negative filtering, grouping, sorting,
  sampling, and set comparison used in prior field trials.
- Every cardinality-changing operation reports bounds and omissions.
- Invalid types, fields, aggregations, and incompatible set operations fail
  before mutation or external effects.
- Operation and field schemas are discoverable without reading source code.

## Verification

- Permanent tests expected: yes, a small public algebra-boundary suite for
  nested predicates, deterministic bounds, and compatible set composition.
- Stable public behavior protected: normalized operation semantics and
  preflight rejection.
- Temporary task validation or field evidence: replay two documented
  JavaScript field-trial reductions through declarative commands.
- Explicitly excluded test levels or mechanisms: tests per operator, private
  helper tests, live relay tests, implementation-shape snapshots.
