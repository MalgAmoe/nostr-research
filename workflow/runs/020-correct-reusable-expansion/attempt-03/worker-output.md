Deliverables changed:
- Added exported, UI-independent targeted expansion operation.
- Corrected reply breadth budgeting and tiny-workspace seed preservation.
- Reduced console expansion to delegation, progress, and cancellation handling.
- Fixed invalid console signal handling to preserve ResearchMemoryError validation.
- Added public functional coverage and documentation updates.

Validation:
- Task validation script passed.
- Full suite: 20 passed, 6 loopback-dependent tests skipped by sandbox.
- Syntax checks passed.
- `git diff --check` passed.

Unresolved uncertainties:
- Local WebSocket scenarios could not execute because the sandbox forbids loopback listeners. No other uncertainties.