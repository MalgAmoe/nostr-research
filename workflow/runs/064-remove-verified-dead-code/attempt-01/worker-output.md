Implemented task 064.

Deliverables changed:
- Removed `IndexedObservationBuffer.candidateIds`.
- Removed its unused `unionIndexes` helper.
- Removed `normalizeProjectionLimit` and `isPublicResearchSet`.
- Removed two unreachable interpreter input checks.
- Preserved all observation-buffer indexes and public behavior.

Validation:
- Syntax checks passed.
- Full functional suite passed: 23/23.
- Source search confirmed dead definitions are absent.
- `git diff --check` passed.

Permanent tests added or expanded: none, as required.

Unresolved uncertainties: none. Runner-owned workflow files were left untouched.