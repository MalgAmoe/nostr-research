Implemented task 039.

Deliverables changed:

- Acquisition handles now expose stable, explicit `acquisition` scope.
- Scoped `select` operates only on acquisition subjects.
- Whole-corpus selection requires `scope: "corpus"`.
- Default acquisition responses now provide bounded previews, facets, completeness, corpus pressure, and eviction effects.
- Detailed relay/event coverage is opt-in via `show` with `mode: "coverage"`.
- `replace: true` advances working handles without mutating canonical evidence.
- Plan and JSONL adapters share the normalized operation path.
- README updated.

Validation:

- Full task validation passed.
- 21 tests passed; 15 relay tests skipped because the sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` passed.

Permanent tests expanded:

- Public session-boundary acquisition scenario now protects scoped versus corpus selection, concise output, bounded coverage projection, handle replacement, and corpus immutability.
- Existing corpus-selection tests were updated to enforce explicit scope.

Unresolved uncertainties:

- Live/loopback acquisition evidence could not run in this sandbox.
- Runner-owned task and run files were left untouched.