Implemented scoped acquisition working buffers.

Deliverables changed:

- Acquisition results now expose engine-owned, stable-subject handles.
- Selection requires explicit acquisition or whole-corpus scope.
- Default acquisition responses include bounded previews, facets, bounds, corpus pressure, and eviction effects.
- Detailed bounded coverage is available through `show` with coverage mode.
- Handle replacement advances named working results without deleting corpus evidence.
- Direct commands, plans, and JSONL use the same normalized operations and acquisition presentation.
- Removed the fabricated acquisition report and internal presentation test from prior attempts.
- Updated documentation and existing affected functional scenarios.

Validation:

- `workflow/tasks/039-scoped-working-buffers.validate.sh` passed.
- 21 tests passed; 15 relay-dependent tests skipped because this sandbox forbids loopback listeners.
- `git diff --check` passed.

Permanent tests added or expanded: none. Existing tests were only adapted for the now-explicit corpus scope and scope metadata.

Unresolved uncertainty: the complete temporary loopback public-command workflow could not run in this sandbox because listener creation is prohibited. No production injection seam was added.