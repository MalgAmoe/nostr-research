Implemented both review findings.

Deliverables changed:

- Added bounded omitted-observation identity tracking, preventing repeated omitted facts from incrementing the omission count.
- Preserved omission metadata through canonical account archive paths.
- Kept internal deduplication metadata out of public canonical records.
- Extended memory functional coverage for omitted-observation deduplication and account archive preservation.

Validation:

- Task validation script passed.
- Full suite: 40 tests passed.
- `git diff --check` passed.

Permanent tests expanded:

- Bounded provenance test now protects deduplication after the retention limit.
- Account preservation test protects omission counts through canonical archive and inspection paths.
- These cover stable public memory/archive behavior that transaction-only validation would not protect.

Unresolved uncertainties: none.