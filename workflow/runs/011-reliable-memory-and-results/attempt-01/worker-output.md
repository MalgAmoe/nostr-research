Implemented task 011 deliverables:

- Atomic, deduplicated bulk creation for retention, run-derived, expanded, and combined sets.
- Bounded set acknowledgements with counts and previews.
- Indexed SQL selection, batched observation hydration, metadata lookup, and indexed derived relationships.
- Seed/discovery result roles and `asCollection()` adapters.
- Deduplicated compact relationship summaries and reference-based provenance.
- Updated CLI compatibility and package documentation.
- Added a 1,050-event functional scenario covering 1,000-member retention, rollback, reopening, traversal, and compact projection bounds.

Validation completed:

- Task validation script passed.
- 15 tests: 11 passed, 4 network tests skipped because loopback listeners are sandbox-restricted.
- Static syntax checks passed.
- CLI help check passed.
- `git diff --check` passed.

Unresolved uncertainties: live relay scenarios could not run under the sandbox; no product-code issues remain known.