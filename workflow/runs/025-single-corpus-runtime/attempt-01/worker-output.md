Implemented task 025’s single-corpus runtime.

Deliverables changed:

- Moved console, acquisition, expansion, reply contexts, sessions, search, inspection, facets, runs, and retained sets onto the bounded in-memory corpus.
- Removed console `--db` and `research.workspace`; `--capacity` is required.
- Added observable acquisition additions, refreshes, evictions, and corpus bounds.
- Added local `load()` and resident-aware `inspect()`.
- Preserved retained subject references after evidence eviction.
- Updated functional scenarios, package metadata, and README.

Validation:

- Task validation script passed.
- 18 tests passed; 9 network tests skipped because loopback listeners are sandbox-blocked.
- Syntax checks and `git diff --check` passed.

Unresolved uncertainties:

- Network scenarios could not execute in this sandbox; their non-network input validation remains covered.
- Runner-owned task state and `workflow/runs/` artifacts were left untouched.