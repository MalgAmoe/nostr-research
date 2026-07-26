Implemented task 043.

Deliverables changed:

- Added explicit provisional judgments with optional strength and caller-authored reason.
- Added composable annotation queries and removal commands.
- Completed handle and retained-set lifecycle commands, including explicit replacement and bulk release.
- Added guarded empty retention via `allowEmpty: true`.
- Added session/schema discovery, literal account-field documentation, and three inspectable templates.
- Updated README documentation.
- Created `workflow/artifacts/composable-session-field-trial.md`.

Validation:

- Task validation script passed.
- 27 tests passed; 15 network tests skipped because loopback is sandbox-restricted.
- `git diff --check` passed.
- Bounded live attempts correctly reported relay connection failures.

Permanent test expanded:

- One public declarative-session scenario protects judgment composition, retained-set versus handle lifecycle, explicit empty retention, normalized template expansion, and response envelopes. Temporary validation was insufficient because these are stable cross-command semantics.

Unresolved uncertainty:

- Successful live relay navigation could not be validated in this sandbox. The artifact records this limitation and identifies bounded canonical evidence import/replay as a still-missing neutral operation.