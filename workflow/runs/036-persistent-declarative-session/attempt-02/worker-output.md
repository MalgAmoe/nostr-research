Deliverables:
- Updated shared operation execution to treat empty typed hydration as a successful structured `no-account-subjects` outcome.
- Added the reviewed acquire → empty accounts → hydrate plan case to the public functional scenario.
- Preserved revision consistency after corpus mutation.

Validation:
- Full task validation passed.
- Syntax checks and `git diff --check` passed.
- 18 tests passed; 16 relay tests skipped because the sandbox forbids loopback listeners.
- Manually verified empty hydration performs no relay contact or corpus mutation.

Unresolved uncertainties:
- The loopback-dependent scenario requires review in an environment permitting local listeners.