Implemented the aggregation review fix.

Deliverables changed:
- Bounded aggregate group keys and `min`/`max` source values.
- Added explicit derived/truncation metadata.
- Expanded the public reference-resolved relation scenario to cover aggregation before and after buffer turnover.

Validation:
- Syntax checks passed.
- Full suite passed: 22/22 tests.
- `git diff --check` passed.
- No debug instrumentation remains.

Permanent test expanded:
- Public functional scenario protecting bounded aggregation, reference resolution changes, joins, scans, and deterministic pagination. Temporary validation was insufficient because this is stable relation-algebra behavior.

Unresolved uncertainties: none.