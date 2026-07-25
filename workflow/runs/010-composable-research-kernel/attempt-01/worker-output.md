Implemented the composable Nostr research kernel.

Deliverables changed:

- Added public subject, resolve, select, traverse, project, retain, and thread operations.
- Routed related-event/account navigation and set expansion through shared traversal.
- Added compact/full/IDs/NDJSON projections with bounded previews.
- Added concise acquisition summaries with exact requests, relay outcomes, counts, and previews.
- Added CLI `thread` support and richer account/set output.
- Updated README with vocabulary and investigation examples.
- Added functional kernel and CLI coverage.

Validation performed:

- Full package test suite passed: 10 passed, 4 network-dependent skipped.
- Syntax checks passed.
- Task validation script passed.
- Protected paths remain unchanged.
- `git diff --check` passed.

Unresolved uncertainties:

- Live relay tests remain skipped because the sandbox forbids loopback listeners; relay networking semantics were not changed.