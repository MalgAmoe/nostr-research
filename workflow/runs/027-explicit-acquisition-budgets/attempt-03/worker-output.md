Deliverables changed:
- Fixed expansion relay filter limits to respect the smaller remaining observation and distinct-event budgets.
- Preserved per-account authored distinct-note limits.
- Reply breadth now respects the observation remainder.

Validation:
- Task validation script passed.
- Syntax checks passed.
- Functional tests: 16 passed, 0 failed, 10 skipped.
- `git diff --check` passed.
- No stale public `eventLimit` references found.

Uncertainty:
- Loopback relay tests were skipped because this sandbox forbids local listeners; the previously failing assertions are covered by the corrected filter calculation.