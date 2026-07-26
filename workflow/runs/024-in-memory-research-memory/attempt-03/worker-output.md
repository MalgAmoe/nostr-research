Deliverables changed:
- Strengthened the eviction invariant in `in-memory-memory.functional.test.js`.
- Evicted event now contributes a quote edge.
- Public traversal verifies that edge disappears after eviction, while a retained source still exposes its evicted target as unresolved.

Validation:
- Focused functional test: 2/2 passed.
- Task validation script passed.
- Full suite: 18 passed, 9 network tests skipped due sandbox restrictions.
- Syntax checks passed.

Unresolved uncertainties:
- None.