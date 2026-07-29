Implemented the truthful contracts and evidence-state task, including the latest review finding.

Deliverables changed:

- Unified and published acquisition timeout/concurrency limits.
- Added stable semantic error codes.
- Corrected archive observation merging and residency reporting.
- Added lineage contradiction validation.
- Added the 100-stage plan limit and rollback/network documentation.
- Added typed compact fallbacks for bounded coverage.
- Expanded public-boundary tests to assert `CAPACITY_EXCEEDED`, `UNKNOWN_MEMBERSHIP`, and `UNRESOLVED_EVIDENCE`.

Validation performed:

- Targeted evidence archive tests: 2/2 passed.
- Full task validation: 41/41 tests passed.
- Syntax checks passed.
- `git diff --check` passed.

Permanent tests expanded: public session and memory scenarios protecting the task’s stable contracts; temporary validation alone would not prevent regression of caller-visible error envelopes and evidence semantics.

Unresolved uncertainties: none.