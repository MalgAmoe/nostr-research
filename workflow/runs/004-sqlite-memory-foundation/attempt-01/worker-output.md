Deliverables created/changed:
- SQLite-backed `@nostr-research/memory` library with canonical event validation, deduplication, provenance observations, reset, fixture import, retrieval, and summary.
- `nostr-research-memory` CLI: init, reset, import-fixture, inspect, summary.
- Inspectable signed fixture corpus and public-library functional test.
- Package documentation and workspace lockfile updates.

Validation performed:
- `npm test --workspace packages/nostr-research`
- `npm run check --workspace packages/nostr-research`
- `workflow/tasks/004-sqlite-memory-foundation.validate.sh`
- Manual two-relay import/inspect/reset/non-zero failure exercise.
- Confirmed no protected paths changed.

Unresolved uncertainties:
- Node emits its current experimental `node:sqlite` warning.
- Local default npm cache is root-owned; validation passed using a writable temporary npm cache.