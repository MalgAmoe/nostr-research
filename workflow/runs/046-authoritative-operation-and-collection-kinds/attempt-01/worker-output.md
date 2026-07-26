Implemented task 046.

Deliverables changed:
- Added authoritative operation, relationship, collection-kind, route, and locality registry.
- Unified plan, session, schema, runtime, template, and preflight semantics.
- Added exact `subject.type` refinement to `events` or `accounts`.
- Assigned narrow continuation output kinds.
- Removed standalone expansion/reply-context APIs, implementations, docs, presentation logic, and obsolete tests.
- Extended the public continuation workflow for typed navigation and hydration composition.

Validation:
- `git diff --check`
- Task validation script
- Full test suite: 22 passed, 9 relay tests skipped because the sandbox forbids loopback listeners.

Permanent tests expanded:
- Public continuation workflow now protects preflight/runtime kind agreement, exact type refinement, both required navigation routes, plan/session composition, hydration compatibility, and schema agreement. Temporary validation alone would not protect this stable cross-layer contract.

Unresolved uncertainties:
- None. Network-specific tests remain intentionally skipped in this sandbox.