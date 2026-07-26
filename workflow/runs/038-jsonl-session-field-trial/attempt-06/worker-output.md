Deliverables changed:
- Updated `packages/nostr-research/src/acquire.js` to explicitly own the raw TCP transport and reset it during cancellation, ensuring peers observe socket closure during stalled TLS setup.

Validation:
- `npm run check`: passed.
- `npm test`: 21 passed, 17 network tests skipped because the sandbox forbids loopback listeners.
- Canonical task validation script: passed.
- `git diff --check`: passed.

Unresolved uncertainty:
- The exact signal/socket regression test remains skipped locally due to sandbox loopback restrictions; it must run in the reviewer’s network-capable sandbox.