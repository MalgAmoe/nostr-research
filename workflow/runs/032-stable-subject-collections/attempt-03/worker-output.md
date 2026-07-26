Deliverables changed:
- Fixed compact account projections to resolve current metadata and report accurate `resolved` state.
- Extended the functional regression for resident and evicted account consistency.

Validation:
- Task validation script passed.
- All syntax checks passed.
- 14 functional tests passed; 13 network tests skipped because loopback listeners are sandbox-restricted.
- `git diff --check` passed.
- No debug instrumentation remains.

Unresolved uncertainties:
- None.