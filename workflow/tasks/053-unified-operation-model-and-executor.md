---
id: 053-unified-operation-model-and-executor
status: ready
max_attempts: 5
validation: workflow/tasks/053-unified-operation-model-and-executor.validate.sh
depends_on: 052-operation-and-state-inventory
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Establish one operation model and executor

## Objective

Make operation semantics predictable by giving normalization, validation,
input/output kinds, locality, mutation, completeness, and execution one
authoritative route shared by direct calls, plans, and sessions.

Use the decisions in
`workflow/artifacts/operation-and-state-inventory.md`. If implementation
evidence contradicts one of its recommendations, record the reason rather than
forcing the code to match the document.

## Work

- Establish one discoverable operation definition and execution route.
- Make direct library use, named plans, and persistent-session commands consume
  the same normalized operation representation.
- Keep subject collections focused on identity, navigation, set, and memory
  views.
- Keep research relations focused on value-oriented tabular analysis.
- Merge, lower, or remove duplicated filter, project, distinct, sort, limit,
  group, summarize, and aggregate implementations according to the inventory.
- Resolve overlapping profile hydration/continuation behavior.
- Make local versus relay-backed execution explicit and consistently reported.
- Remove superseded dispatch, validation, kind inference, and compatibility
  paths once all current callers are migrated.
- Preserve sequential, caller-directed composition; do not introduce task-like
  research commands, automation policy, or another operation language.
- Update active package documentation and schema discovery to match reality.

## Acceptance criteria

- Given an input kind and operation, one authoritative definition describes
  acceptance, output kind, locality, mutation, and execution.
- Plans and sessions no longer reconstruct operation semantics.
- Collection and relation overlap is materially reduced and intentional
  remaining overlap is documented.
- Direct, plan, and session execution agree on result kind and error behavior.
- Failed preflight or execution does not partially mutate session state.
- No compatibility path remains solely for the removed experimental UI or
  historical JavaScript console.
- The resulting code is easier to trace than the baseline and does not replace
  duplication with many shallow abstractions.

## Verification

- Permanent tests expected: consolidate or extend only a few public functional
  paths that prove executor agreement and non-mutation on failure.
- Stable public behavior protected: representative collection, relation,
  plan, and session pipelines; result kinds; local/external reporting.
- Temporary task validation or field evidence: compare schema/preflight and
  runtime results across the same representative operations.
- Explicitly excluded test levels or mechanisms: tests per operation, private
  registry/helper tests, live-relay tests, WebSocket/TCP tests, UI, and
  implementation snapshots.
