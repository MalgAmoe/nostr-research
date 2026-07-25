Deliverables changed:

- Added normalized, operation-specific run input validation.
- Rejected unsupported expansion relationship types before set creation.
- Limited acquisition-run provenance to observations produced by that acquisition.
- Fixed normalized empty query-text handling during run recording.
- Added saved-research library/CLI functionality, documentation, and functional coverage.

Validation:

- Package tests pass: 6 passed, 4 network tests skipped by sandbox.
- Syntax checks pass.
- `git diff --check` passes.
- Direct CLI help confirms discoverable `run` and `set` commands.

Unresolved uncertainty:

- The workflow validation script hangs at its `npm exec` CLI-help checks because npm attempts package resolution in this restricted environment. Equivalent direct CLI checks pass.