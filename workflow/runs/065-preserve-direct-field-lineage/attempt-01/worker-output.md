Implemented direct derive alias lineage preservation.

Deliverables changed:
- `relation.js`: bare field references inherit lineage and `subjectType`; computed expressions clear identity metadata.
- Public functional scenario: verifies alias extraction and confirms constant/`coalesce` identity-like outputs remain untyped.
- README: documents the strict bare-reference boundary.

Validation:
- Syntax checks passed.
- Complete functional suite passed: 23/23.
- Targeted functional test passed.
- `git diff --check` passed.

Permanent test expanded:
- Protects stable public behavior that direct aliases remain navigable while computed values do not gain inferred identity metadata. Temporary validation would not adequately protect schema/extraction interoperability.

Unresolved uncertainties: none.