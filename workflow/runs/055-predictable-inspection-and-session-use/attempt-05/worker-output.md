Implemented the hydration-report discovery correction.

Deliverables changed:
- Centralized collection capability checks in `operations.js`.
- Reused the same capability rule in preflight and contextual discovery.
- Hydration reports now advertise no invalid collection operations.
- Added a public session regression assertion for hydration discovery.

Validation:
- Full task validation passed: 16/16 tests.
- Syntax checks passed.
- `git diff --check` passed.

Permanent tests expanded:
- Public continuation/session workflow now protects the stable rule that hydration-report handles do not advertise operations preflight would reject. Temporary validation alone was insufficient because this defect survived repeated reviews.

Unresolved uncertainties: none.