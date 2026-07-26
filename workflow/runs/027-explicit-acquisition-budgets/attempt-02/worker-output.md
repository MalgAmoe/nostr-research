Implemented explicit acquisition budgets throughout the library:

- Added `observationLimit` and `distinctEventLimit`.
- Added separate packet, observation, duplicate, corpus-storage, and distinct-event counts.
- Propagated budgets through expansion, authored-note acquisition, and reply-context resolution.
- Updated completion reasons, console progress, presentation output, coverage/run validation, README, and canonical context.
- Added duplicate-heavy functional coverage and updated existing fixtures.

Validation:

- Task validation script passed.
- Syntax checks passed.
- 16 tests passed; 10 relay tests skipped because the sandbox forbids loopback listeners.
- `git diff --check` passed.
- No staging or commits performed.
- Existing workflow task/run changes were left untouched.

Unresolved uncertainty: loopback-dependent relay tests could not execute in this sandbox.