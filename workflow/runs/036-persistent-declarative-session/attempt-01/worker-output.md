Implemented the persistent declarative research session.

Deliverables changed:

- Added `src/interpreter.js` with command envelopes, named handles, revisions, semantic errors, cancellation, serialization, and close behavior.
- Refactored `src/plan.js` so plans and individual commands share preflight and execution paths.
- Exported the new public session API.
- Added interpreter syntax checking.
- Added a functional session workflow covering handles, replacement, revision conflicts, preflight atomicity, partial relay outcomes, and executable-code rejection.

Validation performed:

- Task validation script passed.
- All syntax checks passed.
- Tests: 18 passed, 0 failed, 16 network tests skipped because loopback listeners are unavailable in this sandbox.
- Local smoke-tested every local operation and named-plan output handles.
- `git diff --check` passed.

Unresolved uncertainty:

- The relay-backed functional scenario could not execute locally due sandbox loopback restrictions; it remains available for the workspace-write reviewer environment.