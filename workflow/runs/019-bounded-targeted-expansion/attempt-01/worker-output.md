Implemented bounded targeted expansion.

Deliverables:

- Added `research.expand(selection, options)` with validation, global budgets, cancellation, deduplicated filters, workspace hydration, depth-aware traversal, diagnostics, and session independence.
- Added functional coverage for validation and local NIP-01 multi-hop expansion.
- Documented the new console API.

Validation:

- Full task validation passed.
- Full existing suite passed: 20 passed, 5 skipped.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainty:

- Local WebSocket relay scenarios were skipped because this sandbox forbids loopback listeners; the permanent scenario is included for environments permitting them.