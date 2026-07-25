Deliverables changed:
- Added concise expansion dashboard projection in `presentation.js`.
- Added public functional coverage for size bounds, required signals, failure visibility, omitted raw diagnostics, and source immutability.
- Preserved non-expansion presentation behavior.

Validation:
- Full `npm test`: 20 passed, 6 network tests skipped by sandbox.
- Syntax checks passed.
- Console help smoke test passed.
- `git diff --check` passed.

Unresolved uncertainties:
- None. Workflow-owned task/run files were left untouched.