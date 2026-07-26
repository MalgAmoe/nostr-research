Implemented task 026.

Deliverables changed:
- Removed SQLite, SQL, database paths, migrations, transaction code, and workspace implementation.
- Consolidated runtime around one bounded process-local corpus.
- Reworked functional tests for same-process behavior and fresh-process emptiness.
- Updated context, README, roadmap, console help, presentation terminology, and comments.
- Removed obsolete workspace and SQLite comparison tests.

Validation:
- Full task validation passed.
- 16 tests passed; 9 network tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks and `git diff --check` passed.
- Scripted console import/search/traversal/inspection/retention succeeded.
- A fresh console process reported zero events and observations.
- Searches found no active SQLite, SQL, database-path, or workspace implementation.
- Dependency inspection found no SQLite package.

Unresolved uncertainties:
- Live loopback acquisition scenarios could not run in this sandbox.