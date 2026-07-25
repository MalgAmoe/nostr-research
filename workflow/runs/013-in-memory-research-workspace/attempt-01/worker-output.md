Implemented task 013.

Deliverables changed:

- Added public `createResearchWorkspace(memory, { capacity })`.
- Added bounded FIFO eviction, private event/author/kind/tag/relationship indexes, selection, traversal, inspection, incremental hydration, retention, projection, and session compatibility.
- Added public functional workspace scenario.
- Documented workspace semantics in `README.md` and settled vocabulary in `CONTEXT.md`.

Validation:

- Full task validation passed.
- 16 tests passed; 4 network tests skipped due to sandbox restrictions.
- Syntax checks, CLI help check, targeted workspace test, and `git diff --check` passed.

Unresolved uncertainties: none. Workflow-owned task/run files were left untouched; no changes were staged or committed.