Implemented bounded corpus inspection and transparent facets.

- Added `research.show(value, options)` with bounded previews, excerpts, serialized size, and optional evidence details.
- Added deterministic `research.facets(collection, options)` for authors, tags, kinds, relays, domains, and media/link presence.
- Consolidated REPL flood protection around semantic inspection.
- Added process-boundary functional coverage for all supported value types, long notes, repeated observations, facet-driven selection, retention, and reopen.
- Updated README documentation.
- Added `workflow/artifacts/second-console-field-trial.md`.

Validation:

- Full task validation passed.
- 19 tests passed; 4 network tests skipped because loopback listeners are sandbox-blocked.
- Syntax checks and `git diff --check` passed.
- Two public relays were attempted during the field trial; both failed at connection setup in this sandbox. The outcomes and uncertainty are documented.

No unresolved implementation uncertainties. No files were staged or committed.