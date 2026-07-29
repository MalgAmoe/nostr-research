Implemented the Node JSONL controller transport.

Deliverables changed:

- Added `@nostrarium/controller/node` with persistent child-process transport.
- Added request correlation, response timeout, bounded stderr/malformed-output diagnostics, lifecycle status, and idempotent closure.
- Added direct executable resolution without shell/npm.
- Updated package dependencies, lockfile, and Node usage documentation.
- Added functional fixtures and tests.

Validation performed:

- Full task validation passed.
- All 43 research tests passed.
- All 6 controller tests passed.
- Browser bundle check confirmed the runtime-neutral root contains no Node built-ins.
- `git diff --check` passed.
- Protected research source and test paths were untouched.

Permanent tests added:

- Persistent-process workflow protecting handle retention, semantic-versus-transport response distinction, correlation, and graceful closure.
- Malformed-output/process-termination workflow protecting bounded diagnostics and guaranteed request settlement.

Unresolved uncertainties: none.