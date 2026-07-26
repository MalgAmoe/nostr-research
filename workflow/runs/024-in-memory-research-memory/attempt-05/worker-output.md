Deliverables changed:
- Fixed in-memory account summaries to aggregate relays across all resident authored events.
- Added `descriptionExcerpt` parity with SQLite.
- Restored full account projection metadata and observations.
- Added compact account/event projection parity coverage with distinct relays.

Validation:
- Focused functional tests: 2 passed.
- Complete task validation: 18 passed, 9 network tests skipped by sandbox, 0 failed.
- Syntax and diff checks passed.

Unresolved uncertainties: none.