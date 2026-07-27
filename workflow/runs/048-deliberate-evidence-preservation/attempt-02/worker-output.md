Deliverables changed:
- Unified `preserve` and `release-archive` result kinds with their input collection kind.
- Corrected session revisions so empty preserve commands and plan stages are no-ops.
- Expanded the archive functional scenario for handle kinds, plan reporting, and no-op revisions.

Validation:
- Task validation script passed: 21/21 tests.
- Focused archive test passed after final assertions.
- `git diff --check` passed.

Permanent tests expanded:
- The existing public memory/session archive scenario now protects authoritative result-kind agreement and revision behavior. Temporary validation would not adequately protect these declarative session contracts.

Unresolved uncertainties: none.