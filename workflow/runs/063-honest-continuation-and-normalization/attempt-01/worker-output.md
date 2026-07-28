Deliverables created or changed:
- Made `shared-tags` local-only in continuation facts, normalization, schemas, and documentation.
- Added shared relay URL normalization for configuration and acquisition.
- Canonicalized notebook membership names and attribution across create/get/replace/delete.
- Extended existing continuation, configuration, and notebook functional scenarios.

Validation:
- Syntax checks passed.
- Complete functional suite passed: 23/23.
- `git diff --check` passed.

Permanent tests expanded:
- Honest continuation capability and pre-WebSocket rejection.
- Session/acquisition relay URL agreement.
- Canonical membership identity and trimmed attribution.
- These protect stable public behavior that spans multiple public paths.

Unresolved uncertainties: none.