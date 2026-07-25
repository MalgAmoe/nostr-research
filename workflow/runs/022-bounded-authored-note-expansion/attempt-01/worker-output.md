Implemented bounded authored-note expansion.

Deliverables changed:
- Added explicit validated `authoredLimit` expansion option.
- Added per-start-account kind-1 relay requests, global budget enforcement, provenance, and reporting.
- Updated console progress, compact inspection, README, and functional scenarios.
- Added `workflow/artifacts/authored-note-expansion-field-trial.md`.

Validation:
- Full `npm test` passed: 20 passed, 8 loopback tests skipped by sandbox restrictions.
- Syntax checks and task validation script passed.
- `git diff --check` passed.
- Persistent-console field trial completed; retained set reopened successfully.

Unresolved uncertainties:
- Sandbox DNS blocked all public relay connections, so fresh live-note quality could not be assessed. Failures and exact operational counts are documented.
- Local WebSocket scenarios could not execute in this sandbox, though their functional coverage was added.