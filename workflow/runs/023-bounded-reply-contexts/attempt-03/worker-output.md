Deliverables changed:

- Fixed the reply-context functional scenario to read workspace capacity through the valid public `workspace.describe()` API.
- Existing reply-context implementation, console wrapper, documentation, and functional coverage remain intact.

Validation:

- Task validation script passed.
- Complete suite: 20 passed, 0 failed, 9 skipped because loopback listeners are unavailable in this sandbox.
- All JavaScript syntax checks passed.

Unresolved uncertainties:

- The local-relay scenario could not execute in this sandbox, but the reviewed API failure is corrected.