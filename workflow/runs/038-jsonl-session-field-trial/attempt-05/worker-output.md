Deliverables changed:
- Updated `packages/nostr-research/src/acquire.js` to explicitly own, close, and await the raw TCP transport beneath TLS/WebSocket during cancellation.

Validation performed:
- Syntax checks passed.
- Focused JSONL functional test passed; loopback shutdown case was skipped because the sandbox forbids listeners.
- Full task validation passed: 21 passed, 17 network-dependent skipped, 0 failed.
- `git diff --check` passed.

Unresolved uncertainty:
- The exact relay-side socket assertion requires the reviewer’s loopback-capable sandbox to confirm.