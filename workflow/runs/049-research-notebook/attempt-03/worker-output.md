Implemented the reassessed cleanup:

- Removed obsolete `type: "set"`, `isResearchSet()`, and `showSet()` presentation paths.
- Corrected `memberships` and `membership` validation messages.
- Removed stale retained-selection and annotation terminology from `CONTEXT.md`.
- Preserved legitimate collection algebra and JavaScript `Set` usage.

Validation:

- `npm run check`: passed.
- Full test suite: 21/21 passed.
- `git diff --check`: passed.
- Targeted obsolete-shape search: clean.

Permanent tests added or expanded: none in this attempt; the existing public declarative notebook workflow already protects the required stable behavior.

Unresolved uncertainties: none.