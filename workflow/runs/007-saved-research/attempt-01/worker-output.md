Implemented saved research paths.

Deliverables changed:

- Added immutable research runs with inputs, timing, status, diagnostics, results, provenance, and match reasons.
- Added durable named sets with lifecycle, membership, explanations, run import, expansion, and set algebra.
- Added structured CLI `run` and `set` commands plus acquisition `--record`.
- Added end-to-end SQLite/CLI functional coverage.
- Updated package documentation.

Validation:

- Package tests pass: 6 passed, 4 network-dependent skipped by sandbox.
- Syntax checks pass.
- CLI help exposes `run` and `set`.
- `git diff --check` passes.
- Full validator reached its final `npm exec` checks, but npm itself exhausted memory resolving the local binary. Direct invocation of the same binary and help checks pass.

Unresolved uncertainty:

- Live relay tests could not run because the sandbox forbids loopback listeners.
- The npm-exec environment failure remains external to the CLI implementation.