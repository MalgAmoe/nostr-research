Deliverables changed:
- Added relay provenance to `coverage.observedEvents`.
- Removed acquisition coverage record IDs from presentation output.
- Added functional validation for per-observation relay provenance.

Validation:
- Task validation script passed.
- Syntax checks passed.
- Tests: 12 passed, 0 failed, 10 network tests skipped due to sandbox loopback restrictions.
- `git diff --check` passed.

Unresolved uncertainties:
- Network-dependent tests could not run in this sandbox.