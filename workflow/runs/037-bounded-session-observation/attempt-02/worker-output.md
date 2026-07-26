Implemented all review findings.

Deliverables changed:

- Added shared bounded presentation for grouped and summarized `typed-collection` results, including omitted counts.
- Ensured malformed or revision-guarded conflicting `close` commands cannot prematurely cancel active work.
- Corrected external completeness:
  - Hydration reports countable requested/resolved/missing accounts.
  - General acquisition no longer treats `distinctEventLimit` as expected results.
  - Unresolved hydration cannot report `complete`.
- Added a public session workflow test covering grouped and summarized handles.

Validation performed:

- `npm run check` passed.
- Full `npm test` passed: 20 passed, 16 network-dependent tests skipped by sandbox.
- `git diff --check` passed.

Unresolved uncertainties: none.