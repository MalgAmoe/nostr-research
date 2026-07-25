Deliverables changed:
- Fixed WebSocket test relay framing for extended payload lengths.
- Fixed acquisition teardown to track connecting sockets until closure.
- Added cancellation-during-connection regression coverage.

Validation:
- Package tests and syntax checks passed.
- Task validator exited successfully; loopback scenarios were skipped by sandbox restrictions.
- Multi-relay CLI attempt against `relay.damus.io` and `nos.lol` completed with observable `connection-failure` outcomes and zero persisted events.
- `git diff --check` passed.

Unresolved uncertainties:
- Loopback tests could not execute in this sandbox.
- npm 11.11.0’s `npm exec` help invocation exhausted memory after producing expected output; direct CLI help exits normally.