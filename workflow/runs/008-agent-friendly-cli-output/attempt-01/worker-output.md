Implemented agent-friendly CLI output.

Deliverables changed:

- Added `--output compact|full|ids|ndjson` across CLI commands.
- Added compact projections for acquisition, searches, relationships, runs, sets, and mutations.
- Preserved complete evidence and provenance through `--output full`.
- Added composable ID and independently parseable NDJSON output.
- Added root `npm run research -- ...` command.
- Updated root/package READMEs and CLI help.
- Added focused black-box CLI output tests.
- Updated saved-research tests to request full output explicitly.

Validation performed:

- Task validation script passed.
- 8 tests passed; 4 live-network tests skipped because loopback is unavailable.
- Syntax checks and `git diff --check` passed.
- Root CLI command resolved locally and returned help.
- Fixture comparison measured compact search at 918 bytes versus 1,883 bytes full.
- Protected paths remain unchanged.

Unresolved uncertainties:

- Node’s experimental SQLite warning remains on stderr and is documented; it was not globally suppressed.