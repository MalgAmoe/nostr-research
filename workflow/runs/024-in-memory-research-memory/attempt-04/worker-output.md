Deliverables changed:
- Fixed empty-identifier handling for parameterized replaceable events without a `d` tag.
- Added SQLite parity coverage for that case.

Validation:
- Targeted functional tests: 2 passed.
- Full validation: syntax checks passed; 18 tests passed, 9 network tests skipped due to sandbox restrictions.
- `git diff --check` passed.

Unresolved uncertainties:
- None.