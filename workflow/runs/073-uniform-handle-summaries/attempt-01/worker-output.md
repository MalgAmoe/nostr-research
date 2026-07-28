Implemented Task 073.

Deliverables changed:
- Added a uniform factual core under `result.summary` across collections, typed collections, relations, acquisition/hydration, continuation, relay reports, and plan reports.
- Added distinct-subject evidence resolution and conditional event facts.
- Preserved relay- and archive-specific summary details.
- Updated CLI and package documentation.
- Expanded public functional coverage across representative result families.

Validation:
- Task validation script passed.
- Full suite: 32/32 tests passed.
- Targeted tests: 16/16 passed.
- `git diff --check` passed.

Permanent tests expanded:
- Public session-boundary summary contracts protecting explicit units, lineage, bounds/completeness, specialized facts, acquisition event summaries, and distinct-subject relation resolution.
- Permanent coverage is justified because these are stable cross-handle public semantics.

Unresolved uncertainties: none.