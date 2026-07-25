Deliverables created or changed:
- Added public bounded relay acquisition with cancellation, concurrency, validation, provenance, global limits, structured results, and socket cleanup.
- Added CLI `acquire` command with explicit relays, JSON/file filters, timeout, event limit, and input validation.
- Added black-box WSS/NIP-01 functional scenarios.
- Documented defaults, outcomes, counts, API, and CLI usage.

Validation:
- Unit/functional tests pass: 2 passed, 3 WSS scenarios skipped because the sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` pass.
- Reference client remains unchanged.
- Public-relay attempt against `relay.damus.io` and `nos.lol` completed with distinct `connection-failure` outcomes due restricted networking.
- Invalid `ws://` relay correctly exited non-zero.
- Validation script’s test/check stages passed; its final `npm exec` command hung in this environment, though direct CLI help succeeds.

Unresolved uncertainties:
- Deterministic WSS scenarios require rerunning where loopback listeners are permitted.
- A live acquisition needs repeating where outbound WebSocket access is available.