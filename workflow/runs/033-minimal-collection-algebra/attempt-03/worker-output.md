Deliverables changed:

- Made grouped and summarized typed collections reusable through `asCollection()`, with shape and kind validation.
- Preserved and merged incoming provenance during collection re-resolution.
- Added functional coverage for separately invoked group/summarize stages and provenance across transformations.
- Updated eviction provenance expectations.

Validation:

- Task validation script passed.
- Full suite: 16 passed, 13 network tests skipped by sandbox, 0 failed.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainties: none.