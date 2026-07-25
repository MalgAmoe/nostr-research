Deliverables completed:

- Added compact, full, IDs, and NDJSON CLI output modes.
- Added compact projections for acquisition, searches, relationships, runs, and sets.
- Preserved full evidence/provenance output.
- Added root `npm run research -- ...` command.
- Updated root and package documentation.
- Added focused black-box CLI output coverage and adapted existing tests.

Validation performed:

- Task validation script passed.
- 8 tests passed; 4 network tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks passed.
- Compact fixture search measured 883 bytes versus 1,848 bytes for full output (48%).
- Confirmed full output retains canonical events and observations.
- Confirmed NDJSON records parse independently.
- `git diff --check` passed.

Unresolved uncertainties:

- Live acquisition scenarios remain untested in this sandbox due to loopback restrictions.
- Node’s SQLite experimental warning remains on stderr and is documented as runtime noise.