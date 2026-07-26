Implemented the requested shutdown correction.

- Wired SIGINT/SIGTERM directly to declarative session closure through an AbortSignal.
- Active external operations are now cancelled immediately; stdin no longer needs to reach EOF first.
- Added process-boundary coverage using a deliberately stalled relay connection, verifying prompt termination and socket closure.
- Preserved protocol-clean stdout and conventional exit codes 130/143.

Validation:

- Task validation script passed.
- Full suite: 21 passed, 17 network tests skipped because the sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` passed.
- No debug instrumentation remains.

Unresolved uncertainty: the new live socket cancellation assertion was skipped in this restricted sandbox, but will execute in environments permitting loopback listeners.