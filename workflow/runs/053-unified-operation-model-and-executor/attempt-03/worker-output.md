Deliverables changed:
- Removed obsolete version-1 collection schema and supporting dead constants/helpers.
- Unified hydration results as explicit `hydration-report` values across direct executor, plan, session-backed, empty, and non-empty paths.
- Extended public functional coverage for hydration result-kind agreement.

Validation:
- Task validation script passed.
- Syntax checks passed.
- All 16 functional tests passed.
- `git diff --check` passed.
- Confirmed obsolete schema identifiers are absent.

Permanent tests expanded:
- Hydration functional scenario now protects stable public result-kind agreement. Temporary validation was insufficient because direct/plan divergence could silently recur.

Unresolved uncertainties: none.