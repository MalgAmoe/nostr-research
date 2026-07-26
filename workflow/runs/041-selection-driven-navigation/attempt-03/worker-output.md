Implemented the 1,000-item completeness boundary.

- Local projections request `eventLimit + 1` below 1,000.
- A projection returning 1,000 at the absolute ceiling conservatively reports `partial`, non-exhaustive, with `event-limit`.
- Expanded the existing continuation functional scenario to protect this stable completeness behavior.

Validation:

- Targeted continuation test passed.
- Full task validation passed: 26 tests passed, 15 network tests skipped because loopback listeners are sandbox-restricted.
- `git diff --check` passed.

Permanent tests expanded: the single public-boundary continuation scenario now covers typed handle input and conservative completeness at the memory query ceiling. Temporary validation cannot reliably protect this subtle stable boundary.

Unresolved uncertainties: live relay validation was not rerun in this sandbox.