Implemented both review findings.

Deliverables:
- Fixed offset-aware case folding to use exact whole-string lowercase output while retaining original UTF-16 boundary mapping.
- Extended the public functional scan scenario with Greek final-sigma matching (`ΟΣ` → `ος`) and verified original offsets `7..9`.

Validation:
- Focused functional test: passed.
- Static checks: passed.
- Full task validation: 43/43 tests passed.
- `git diff --check`: passed.

Permanent tests expanded:
- Public relation scan scenario now protects both Unicode length expansion (`İ`) and context-sensitive casing (`ΟΣ`). Temporary validation would not adequately prevent regression in stable scan matching and original-text offset semantics.

Unresolved uncertainties: none.