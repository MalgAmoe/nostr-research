Implemented signal-shutdown corrections:

- Cancellation now immediately terminates owned relay transports instead of using graceful WebSocket closure.
- The executable keeps Node alive until asynchronous session cleanup finishes.
- Existing process-level signal regression test remains the validation seam.

Checks performed:

- Full task validation passed.
- 21 tests passed; 17 network-dependent tests were skipped because this sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainty:

- The exact peer-socket assertion could not run locally due sandbox restrictions; it must be confirmed in the reviewer’s loopback-enabled environment.