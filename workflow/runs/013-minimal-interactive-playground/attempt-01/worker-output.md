Implemented the minimal interactive research playground.

Deliverables created or changed:

- New local app under `apps/research-playground/`.
- Root `npm run playground` command.
- SQLite-backed server adapter using public library/session operations.
- Streamed per-relay acquisition progress and outcomes.
- Selection, focus, include/exclude, traversal, branches, back, checkpoints, and saved-set reopening.
- Responsive note/account rendering with media, provenance, and raw protocol evidence.
- Server integration and browser-shell smoke tests.
- README startup, address, and data-location documentation.
- Small public acquisition progress callback seam.

Validation performed:

- `npm test` passed.
- `npm run check` passed.
- Task validation script passed.
- `git diff --check` passed.
- Startup resolves correctly through the root command.

Unresolved uncertainties:

- This execution sandbox forbids loopback listeners, so HTTP integration tests and live browser verification were skipped with explicit reasons. The connected browser was also unavailable. A reviewer environment permitting localhost should run those scenarios fully.
- Existing workflow task/run changes were preserved and not modified.