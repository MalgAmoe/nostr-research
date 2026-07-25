Implemented task 006.

Deliverables changed:

- Added local event search with composable constraints, deterministic ordering, bounded results, provenance, and match reasons.
- Added current kind-0 account resolution and metadata search.
- Added evidence-backed inbound/outbound navigation with NIP-10/NIP-22 interpretation and unresolved references.
- Added CLI commands: `search`, `accounts`, `account`, and `related`.
- Documented query semantics and CLI usage.
- Added reproducible signed-fixture functional tests.

Validation:

- Package tests pass: 5 passed, 4 live-relay tests skipped because loopback is sandbox-restricted.
- Syntax checks pass.
- Task validation script passes using a writable temporary npm cache.
- CLI success and non-zero failure paths verified with real temporary SQLite storage.
- `git diff --check` passes.
- Protected reference-client files were unchanged.

Unresolved uncertainties: none.