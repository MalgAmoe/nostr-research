Deliverables changed:

- Fixed acquisition coverage under same-operation eviction.
- Preserved relay provenance in expansion results.
- Corrected default authored-expansion scenario.
- Updated inspection assertion to use `resident`.
- Kept SQLite comparison behavior aligned.

Validation:

- `npm test`: 27 tests, 18 passed, 9 network tests skipped due sandbox loopback restrictions, 0 failures.
- `npm run check`: passed.
- Task validator: passed.
- `git diff --check`: passed.

Unresolved uncertainty:

- Loopback network scenarios could not run in this sandbox; they remain available for the reviewer environment.