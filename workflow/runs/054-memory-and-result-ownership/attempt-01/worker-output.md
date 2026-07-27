Deliverables changed:
- Added `src/collection.js` as the authoritative collection identity/navigation engine.
- Reduced `src/index.js` by 350 lines, leaving memory focused on owned state and resolution.
- Added consistent `event.hasMedia`, distinct relation subject/author counts, and balanced multi-input continuation.
- Clarified ownership and lifecycle documentation.
- Preserved thin direct-memory compatibility methods without duplicating corpus state.

Validation:
- Task validation script passed.
- Syntax checks passed.
- All 16 functional tests passed.
- `git diff --check` passed.

Permanent tests expanded:
- Media resolution and distinct relation counts: protects stable public research output across evidence lifetimes.
- Multi-input continuation balancing: protects representative navigation against input starvation.
- Permanent coverage is justified because these are named public seam behaviors and regressions would be difficult to detect through temporary validation alone.

Unresolved uncertainties:
- None.
- Runner-owned task status and `workflow/runs/` files were not modified.