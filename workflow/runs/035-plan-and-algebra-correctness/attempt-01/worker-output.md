Implemented task 035 correctness fixes.

Deliverables changed:

- Complete named-plan preflight using runtime normalization rules.
- Strict acquisition-only dependencies for `select`.
- Fresh stable-subject resolution for reusable grouped collections.
- Exact group membership, retained, omitted, and truncation fields.
- Exact grouped `count` aggregation semantics.
- Duplicate normalized aggregation-name rejection.
- README documentation and focused functional scenarios.

Validation performed:

- Full task validation passed: 18 passed, 14 network tests skipped by sandbox.
- Focused collection-algebra tests: 4 passed.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainties:

- Live relay scenarios could not run because the sandbox forbids loopback listeners.