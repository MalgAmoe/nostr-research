Deliverables changed:

- Added `createInMemoryResearchMemory()` and `InMemoryResearchMemory`.
- Implemented bounded FIFO evidence storage, observations, indexes, relationships, traversal, profiles, runs, coverage, sets, retention, combination, and projection.
- Added SQLite parity and eviction-invariant functional tests.
- Left existing production consumers on SQLite.

Validation:

- Syntax checks pass.
- Full suite passes: 18 passed, 9 network tests skipped by sandbox.
- `git diff --check` passes.

Unresolved uncertainties:

- Network scenarios could not run because the sandbox forbids loopback listeners.
- Existing workflow-owned task/run changes were left untouched.