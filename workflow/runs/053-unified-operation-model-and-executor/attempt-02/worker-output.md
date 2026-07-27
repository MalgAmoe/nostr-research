Implemented both review findings.

Deliverables changed:
- Removed collection implementations for project, distinct, sort, group, and summarize.
- Kept collection filter narrowly identity-focused; relation filter owns value analysis.
- Removed relation limit in favor of slice.
- Unified hydrate and profile continuation through shared account-bound acquisition.
- Updated operation definitions, executor routing, schema discovery, README, and functional coverage.
- Removed obsolete tests for superseded collection analytics.

Validation:
- Task validation script passed.
- Syntax checks passed.
- 16/16 functional tests passed.
- `git diff --check` passed.

Permanent tests:
- Consolidated public functional coverage for direct/plan/session executor agreement, failure non-mutation, and the collection-to-relation analysis boundary.
- Removed tests that froze intentionally removed collection-analysis behavior.

Unresolved uncertainties: none.