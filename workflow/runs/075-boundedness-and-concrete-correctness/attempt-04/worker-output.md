Implemented the review fix.

Deliverables changed:

- Preserved `omittedObservationCount` through event selection and account collection resolution.
- Coverage presentation now summarizes resolved evidence instead of stale unresolved collection items.
- Expanded the public memory/session functional scenario to verify preview, coverage, selection, account resolution, and archive propagation.

Validation:

- `git diff --check` passed.
- Task validation passed: 40/40 tests.
- Syntax checks passed.
- No debug instrumentation remains.

Permanent tests expanded:

- Public memory/session functional test protects bounded provenance and machine-readable discarded-attempt counts across collection views. Temporary validation was insufficient because this is stable public provenance behavior spanning memory and presentation boundaries.

Unresolved uncertainties: none.