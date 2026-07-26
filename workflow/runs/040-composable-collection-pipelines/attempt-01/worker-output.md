Implemented task 040.

Deliverables changed:

- Extended the typed collection pipeline with projection, distinct values, stable sorting, limits, deterministic sampling, grouping, aggregation, movement, and compatible set algebra/comparison.
- Added bounds and omission metadata.
- Preserved subject identity, reasons, and provenance.
- Kept `account.name` and `account.display_name` literal and separate.
- Added schema discovery for library and JSONL/declarative sessions.
- Enabled named-result set composition in plans and sessions.
- Updated README documentation.
- Added two declarative field-trial replays in [040-composable-collection-pipeline-replays.md](/Users/malg/Documents/Codex/nostr/workflow/artifacts/040-composable-collection-pipeline-replays.md).

Validation:

- Task validation script passed.
- Syntax checks passed.
- Full suite: 24 passed, 15 environment-dependent tests skipped, 0 failed.
- `git diff --check` passed.
- Protected workflow runner and prompt files were unchanged.

Permanent tests added or expanded:

- Public algebra-boundary coverage for nested predicates, literal projection fields, distinct values, deterministic sampling and bounds, compatible set composition, named-plan reuse, declarative comparison, schema discovery, and preflight rejection.
- These protect stable normalized semantics and rejection-before-effects behavior; temporary validation alone would not adequately guard compatibility across the three public execution paths.

Unresolved uncertainties: none.