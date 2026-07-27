Implemented task 048.

Deliverables changed:
- Separated the renewable observation buffer from a bounded evidence archive.
- Added reference, excerpt, and canonical preservation levels with atomic capacity enforcement.
- Added archive-aware resolution, provenance merging, and replaceable-event selection.
- Added normalized `preserve`, `archived`, and `release-archive` plan/session operations.
- Removed acquisition’s obsolete `preserve` option.
- Updated presentation, relation resolution, schema discovery, and documentation.
- Kept handle release distinct from archived-evidence release.

Validation:
- Task validation script passed.
- Syntax checks passed.
- Full suite passed: 21/21 tests.
- `git diff --check` passed.

Permanent tests:
- Added one public memory/session functional scenario covering all preservation levels, complete turnover, replacement ordering, resolution sources, atomic failures, revisions, lifecycle reset, and release semantics. Permanent coverage is justified because these are stable cross-layer ownership guarantees.

Unresolved uncertainties: none.