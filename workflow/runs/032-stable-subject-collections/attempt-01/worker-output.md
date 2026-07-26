Deliverables changed:

- Stable subject-based collection re-resolution for current events, metadata, and provenance.
- Added exact event/account `lookup(subject)` API and console access.
- Consistent `resident` state for raw and presented inspection.
- Prevented caller-supplied records/provenance from entering constructed collections.
- Updated documentation and focused functional regression coverage.

Validation:

- Task validation script passed.
- 14 tests passed; 13 network tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks and `git diff --check` passed.
- Focused collection and console tests passed.

Unresolved uncertainties: none.