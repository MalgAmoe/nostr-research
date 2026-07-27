Implemented the complete research-memory turnover trial.

Deliverables changed:

- Added `workflow/artifacts/research-memory-turnover-field-trial.md`.
- Removed duplicate legacy corpus fields from `describe()`.
- Made session status expose buffer, archive, notebook, and handle sizes separately.
- Fixed `show` for notebook-membership handles after turnover.
- Removed remaining retention-oriented internal naming.
- Updated `CONTEXT.md`, root/package documentation, and `workflow/ROADMAP.md`.
- Updated affected functional assertions for the final ownership model.

Validation performed:

- Deterministic full-turnover scenario through the real JSONL executable.
- Bounded public-relay attempt; network access was denied and recorded honestly.
- `npm run check`: passed.
- `npm test`: 22/22 passed.
- Task validation script: passed.
- `git diff --check`: passed.

Permanent tests expanded:

- Extended the existing notebook-turnover functional scenario to protect the stable public behavior that a notebook-membership handle remains showable after its evidence becomes unresolved. Temporary validation was insufficient because the trial uncovered an actual `INTERNAL_ERROR` at the public session boundary.

Unresolved uncertainties:

- Public-relay ergonomics require a network-enabled environment.
- Over-limit presentation options can still surface a generic internal error; documented as outside this storage-lifecycle task.