Deliverables changed:

- Pruned research runs, acquisition history registry, generic set mutation/algebra, `load`, `searchEvents`, related wrappers, and core `summary`.
- Acquisition now returns complete attempt coverage directly.
- Preserved retained selections, provenance, traversal, expansion, reply contexts, sessions, inspection, and presentation.
- Updated documentation, canonical context, console adaptation, and functional tests.

Validation performed:

- Task validation script passed.
- Syntax checks passed.
- Tests passed: 12 passed, 10 skipped due sandbox restrictions on loopback listeners.
- `git diff --check` passed.
- No staging or commits performed.

Unresolved uncertainties:

- Network-backed tests could not execute because the sandbox forbids loopback listeners; their non-network validation and syntax checks passed.