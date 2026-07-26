Implemented named research plans.

Deliverables changed:

- Added public `executeResearchPlan()` with eight justified operations.
- Added acquisition/hydration/retention integration and named-stage reuse.
- Added functional coverage for full lifecycle and local-only plans.
- Updated README documentation and syntax checks.
- Created `declarative-research-plan-field-trial.md` with exact plan data, budgets, results, judgments, JavaScript, and findings.

Validation:

- Task validation script passed.
- 17 tests passed; 14 network/loopback tests skipped by sandbox.
- Syntax checks and `git diff --check` passed.
- No files staged or committed.

Unresolved uncertainty:

- Fresh live relay acquisition was blocked by sandbox DNS (`ENOTFOUND`). The artifact documents the failed live attempts separately from the successful controlled canonical-evidence trial. A live rerun remains required when network access is available.