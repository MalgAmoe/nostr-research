Implemented the runtime-neutral core milestone.

Deliverables changed:

- Acquisition now uses the standard global WebSocket API.
- Removed `ws`, `terminate()`, and timer `unref()` assumptions.
- Completion is deterministic for timeout, cancellation, EOSE, CLOSED, failures, and budgets.
- Late socket messages cannot mutate completed acquisition results or memory.
- Presentation sizing now uses `TextEncoder` for UTF-8 measurement.
- Removed `ws` from package metadata and lockfile.
- Updated `CONTEXT.md`, package documentation, and milestone status.

Validation performed:

- Full task validation passed.
- All 23 functional tests passed.
- Syntax checks passed.
- Public-core import succeeded with `Buffer` unavailable.
- Confirmed no Node-only imports or `Buffer` usage in the public core.
- Temporary timeout scenario confirmed late messages cannot alter accounting.
- `git diff --check` passed.

Permanent tests added or expanded: none; existing public-boundary coverage plus temporary task validation was sufficient.

Unresolved uncertainties: none.