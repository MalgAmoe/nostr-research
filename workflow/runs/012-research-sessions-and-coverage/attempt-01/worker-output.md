Implemented task 012.

Deliverables changed:

- Added public temporary research sessions with selection, focus, inclusion/exclusion, branches, history/back, traversal, checkpointing, and views.
- Added durable SQLite acquisition coverage and reusable acquisition result collections.
- Added bounded planning helpers for time slicing, NIP-11 retrieval/limits, and NIP-65 parsing.
- Updated public exports, schema version, documentation, project context, and functional tests.

Validation performed:

- Task validation script passed.
- 14 tests passed; 4 live-network tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainties:

- Live relay behavior was not exercised in this sandbox; stable protocol and public-library scenarios passed.