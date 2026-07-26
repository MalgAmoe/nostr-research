Deliverables changed:
- Updated `packages/nostr-research/src/acquire.js` so cancellation forcibly destroys the owned TCP transport, preventing indefinite half-closed connections after SIGTERM.

Validation:
- Full task validation passed.
- Syntax checks passed.
- 21 tests passed; 17 network tests were skipped because the sandbox forbids loopback listeners.
- No debug instrumentation remains.

Unresolved uncertainty:
- The exact SIGTERM regression test was sandbox-skipped, but the reviewed failure path is directly corrected at its transport ownership boundary.