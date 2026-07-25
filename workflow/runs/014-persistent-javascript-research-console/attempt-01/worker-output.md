Implemented the persistent JavaScript research console.

Deliverables:

- Added `nostr-research-console` package executable and root `research-console` launcher.
- Added persistent Node REPL with top-level `await`, bounded workspace, clean shutdown, and startup validation.
- Added compact `research` API for loading, acquisition, search, sessions, traversal, comparison, inspection, and retention.
- Added bounded REPL rendering and acquisition progress.
- Added process-boundary functional coverage.
- Documented startup, shutdown, bindings, persistence, loading versus acquisition, and example workflow.
- Updated package metadata and lockfile.

Validation:

- Full task validation passed: 17 tests passed, 4 network tests skipped by sandbox.
- Syntax checks passed.
- Piped multi-expression console scenario passed.
- Interactive PTY launch and clean exit passed.
- SQLite reopening immediately after exit passed.

Unresolved uncertainties:

- Live relay behavior was not exercised because the sandbox forbids loopback/network relay tests. Existing acquisition validation remains passing or appropriately skipped.