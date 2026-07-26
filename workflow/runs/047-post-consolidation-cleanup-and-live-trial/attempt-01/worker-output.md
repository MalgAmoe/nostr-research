Implemented the post-consolidation cleanup.

Deliverables changed:

- Removed obsolete account-search/result coercion and presentation branches.
- Removed legacy `resolveAccount`, `searchAccounts`, and `thread` surfaces.
- Made acquisition and empty hydration construct explicitly typed collections.
- Preserved acquisition provenance in constructed collections.
- Updated package README and `CONTEXT.md` with the reduced architecture.
- Removed the obsolete research-kernel test and legacy account-search coverage.
- Added the field-trial report at [consolidated-navigation-field-trial.md](/Users/malg/Documents/Codex/nostr/workflow/artifacts/consolidated-navigation-field-trial.md).

Validation:

- Full task validation passes.
- 20 tests passed; 9 loopback-dependent tests skipped by sandbox.
- `git diff --check` passes.
- No stale compatibility identifiers remain.

Permanent tests added or expanded: none. Existing public handle workflow covers the corrected typed-collection path.

Unresolved uncertainty:

- The required successful live trial could not be completed because all four tested public relays returned connection failures in this sandbox. Exact attempts, bounded results, the handle-only continuation script, and the incomplete verdict are recorded truthfully in the artifact.
- No dynamic JavaScript or manual stable-ID copying was used.