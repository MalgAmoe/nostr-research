Implemented the minimal typed collection algebra.

Deliverables changed:

- Added `memory.transform()` with typed, JSON-serializable `filter`, `group`, `summarize`, and `move` stages.
- Added bounded aggregations, predicate composition, stage naming/context, deterministic outputs, and reason/provenance preservation.
- Added functional algebra scenarios.
- Documented the public API in the README.

Validation:

- Task validation passed.
- 16 tests passed; 13 network tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks and `git diff --check` passed.
- No protected files, workflow status, or run artifacts were modified by me.

Unresolved uncertainties:

- Live relay scenarios were not runnable in this sandbox; local algebra behavior is fully validated.