Deliverables changed:

- Updated root and package READMEs to document `npm run --silent research -- …`.
- Added boundary coverage proving the documented root invocation emits directly parseable JSON without npm’s banner.

Validation performed:

- Focused CLI output tests: 3 passed.
- Full task validation: 9 passed, 4 network tests skipped by sandbox.
- Syntax checks and `git diff --check`: passed.

Unresolved uncertainties:

- None. Node’s SQLite experimental warning remains on stderr only and does not affect JSON stdout.