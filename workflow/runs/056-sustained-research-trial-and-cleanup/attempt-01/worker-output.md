Deliverables created or changed:
- Added `workflow/artifacts/simplified-system-field-trial.md` documenting both sustained sessions and verdict.
- Fixed acquisition reports missing their authoritative result type.
- Fixed general `subjects` collections rejecting homogeneous subsets.
- Corrected archive query schema fields.
- Aligned `CONTEXT.md`, both READMEs, and `workflow/ROADMAP.md`.
- Removed disposable trial transport files; no superseded production modules or duplicate session model remained.

Validation:
- Full task validation passed.
- All 16 functional tests passed.
- Syntax checks, focused schema/collection checks, `git diff --check`, artifact checks, and protected-path checks passed.

Permanent tests added or expanded: none. The defects arose through environment-specific acquisition trials; permanent WebSocket-level testing is explicitly excluded.

Unresolved uncertainties:
- Public relays could not be evaluated because sandbox DNS failed.
- Hydration reports cannot be scoped directly with `select`; relating the original account handle works, so no duplicate operation was added.
- Pre-existing runner-owned task/run changes were preserved untouched.