Implemented bounded reply-context resolution.

Deliverables changed:

- Added exported `resolveReplyContexts()` operation.
- Added thin `research.replyContexts()` console wrapper.
- Added shared authored/parent timeout and observation budgets.
- Added NIP-10 parent resolution, deduplication, provenance, request reports, and explicit unresolved states.
- Added functional coverage and input validation scenarios.
- Updated syntax checks and README documentation.

Validation:

- Task validation script passed.
- 20 tests passed.
- 9 relay tests skipped because this sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainty:

- Local WebSocket relay scenarios could not execute in this sandbox; they remain available for validation where loopback listeners are permitted.