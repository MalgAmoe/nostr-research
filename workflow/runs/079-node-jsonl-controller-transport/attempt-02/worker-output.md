Implemented the review fix.

Deliverables changed:
- Node transport now settles `close()` on the child’s definitive `close` event, including spawn failures.
- Added a public-boundary invalid-working-directory scenario verifying request failure, bounded diagnostics, and idempotent closure.

Validation:
- Controller tests: 7/7 passed.
- Full task validation: passed.
- Research library tests: 43/43 passed.
- Syntax checks: passed.

Permanent test expanded:
- Protects stable spawn-failure and idempotent-close behavior; temporary validation was insufficient because the original defect could hang callers indefinitely.

Unresolved uncertainties: none.