Implemented task 029.

Deliverables changed:

- Explicit `activate(result)` state transition.
- Stateless `traverse(result, options)` signature.
- Separate `retain(result, name, options)` and `checkpoint(name, options)`.
- Reduced session to active selection and checkpoint state.
- Simplified corpus status and compact presentation.
- Updated console workflow tests, README, help, and canonical context.

Validation:

- Syntax checks passed.
- Functional suite passed: 12 passed, 10 network tests skipped by sandbox.
- Task validation script passed.
- `git diff --check` passed.
- Prohibited overload scan is clean.

Unresolved uncertainties: none.