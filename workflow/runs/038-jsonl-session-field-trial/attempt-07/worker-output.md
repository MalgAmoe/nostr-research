Deliverables changed:
- `packages/nostr-research/src/acquire.js`: cancellation now ends the owned TCP transport cleanly with FIN and waits for closure, avoiding peer-side `ECONNRESET`.

Validation performed:
- Canonical validation passed.
- Syntax checks passed.
- Test suite: 38 tests, 0 failures; 21 passed and 17 network tests skipped because the sandbox forbids loopback listeners.
- Confirmed no debug instrumentation remains.

Unresolved uncertainty:
- The exact signal-cancellation regression test was sandbox-skipped; it must run in the reviewer environment with loopback access.