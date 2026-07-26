Implemented task 037.

Deliverables changed:

- Deepened shared bounded projections in `src/presentation.js`.
- Added `show`, `inspect`, `explain`, `list`, and `status`.
- Added `release`, `reset`, and `close` lifecycle commands.
- Added structural completeness reporting and plan-stage warnings.
- Added an end-to-end declarative observation/lifecycle functional test.

Validation performed:

- Task validation script passed.
- Full test suite passed: 19 passed, 16 network-dependent tests skipped.
- Syntax checks and `git diff --check` passed.
- Confirmed release preserves corpus evidence and retained selections.
- Confirmed observation commands preserve revision and post-close commands fail.

Unresolved uncertainties:

- Live relay tests could not run because the sandbox forbids loopback listeners.
- Workflow-owned task/run changes were pre-existing and left untouched.