Deliverables changed:
- Fixed relay cancellation to destroy TLS and raw TCP transports and await raw socket closure.
- Corrected field-trial documentation to reflect the prior failure and new shutdown behavior.

Validation:
- Full task validation passed.
- 38 tests: 21 passed, 17 loopback-dependent tests skipped by sandbox.
- Syntax checks and `git diff --check` passed.
- No debug instrumentation remains.

Unresolved uncertainty:
- The exact SIGTERM loopback scenario remains skipped locally due to sandbox restrictions; it requires confirmation in the runner’s loopback-enabled validation environment.