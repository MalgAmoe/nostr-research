Implemented the signal-shutdown fix.

- Changed `acquire.js` to track the underlying TLS transport and await its actual closure before completing cancellation.
- Prevented the early WebSocket `close` event during handshake cancellation from prematurely completing session shutdown.
- Ran the complete task validation, syntax checks, full test suite, and `git diff --check`; all available checks passed.
- 21 tests passed; 17 network tests were skipped because this sandbox forbids loopback listeners.

Unresolved uncertainty: the exact relay-socket signal test could not execute under the sandbox’s loopback restriction, though the reviewed transport lifecycle race is now directly addressed.