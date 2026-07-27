Deliverables changed:
- Unified operation definitions now own input/output kinds, locality, mutation, completeness, and executor routing.
- Direct calls, plans, and sessions share normalization, preflight, and execution.
- Schema discovery and package documentation updated.
- `replace-membership` merged into `remember-membership`.
- Notebook writes preflight capacity atomically.
- Public executor APIs exported.

Validation:
- Task validation script passed.
- Syntax checks passed.
- 23/23 functional tests passed.
- `git diff --check` passed.

Permanent tests expanded:
- Added one public functional scenario protecting direct/plan/session result-kind agreement and session non-mutation after failed execution. Temporary validation alone would not protect this central executor contract.

Unresolved uncertainties:
- Older collection analytical transforms and `hydrate` remain because they are active direct-library behavior; their intentional overlap and preferred relation/profile-continuation routes are documented.
- No live-relay validation was performed, as explicitly excluded.