Implemented concise expansion inspection with review fixes.

- Added compact expansion dashboard with counts, capacity, uncertainty, bounds, completion reason, and failures.
- Added progressive failure compaction for the 1,000-byte minimum limit.
- Strengthened functional coverage with six unique long relay failures.
- Preserved original expansion requests and diagnostics unchanged.
- Verified raw filters and successful relay details are omitted from shown output.
- Ran full test suite: 20 passed, 6 network tests skipped by sandbox.
- Ran syntax checks, console help check, and `git diff --check`; all passed.

Unresolved uncertainties: none.