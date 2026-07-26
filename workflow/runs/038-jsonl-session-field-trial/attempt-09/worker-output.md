Deliverables changed:
- Fixed relay cancellation in `src/acquire.js` by tracking and closing both TLS and underlying TCP transports.
- TLS closure is now the acquisition shutdown boundary.

Validation:
- Syntax checks passed.
- Acquisition and JSONL functional suites passed where runnable.
- Full task validation passed: 21 tests passed, 17 network tests skipped.

Unresolved uncertainty:
- The sandbox forbids loopback listeners, so the exact SIGTERM socket-closure scenario was skipped locally and requires reviewer validation in a loopback-enabled sandbox.