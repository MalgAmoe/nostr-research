Implemented the bounded-presentation correction.

Deliverables changed:
- Compact relation `details` responses now preserve one evidence-bearing row and one next-operation identifier at `sizeLimit: 1000`.
- Secondary relation values are omitted only in the essential fallback.
- Existing task documentation, session/executor changes, README walkthrough, and functional workflows remain intact.

Validation:
- Full task validation passed: 16/16 tests.
- Focused observation workflow passed: 3/3 tests.
- Reproduction response is 987 bytes with canonical event ID, one preview row, and contextual `project` discovery.
- `git diff --check` passed.

Permanent tests expanded:
- Public declarative session workflow protects bounded observation modes, revisions, contextual discovery, and canonical relation details at the minimum size bound. Temporary validation alone was insufficient because this exact stable envelope behavior repeatedly regressed.

Unresolved uncertainties: none.