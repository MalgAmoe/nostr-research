Deliverables changed:

- Removed production `importFixtures()`, `loadFixtureEvents()`, and `node:fs`.
- Added test-only fixture loading; functional tests now use public `ingest()`.
- Changed console API to `inspect(subject)`.
- Documented the `inspect`/`show` responsibility split.
- Removed fixtures from published package contents.

Validation:

- Task validation passed.
- 13 tests passed; 12 network tests skipped due to sandbox loopback restrictions.
- Syntax checks, `git diff --check`, interface searches, and package dry-run passed.
- Confirmed fixture/test-support files are not published.

Unresolved uncertainties: none.