Implemented task 075’s remaining correction.

Deliverables changed:

- Removed the rolling omitted-observation identity cache.
- Retained observations deduplicate exactly up to the 100-item bound.
- Every post-bound discarded ingestion increments `omittedObservationCount`, including repeated attempts.
- Omission counts remain preserved through snapshots, archive, resolution, account evidence, and presentation.
- Existing collection refinement, null-preserving division, WebSocket send-failure handling, and invalid-signature coverage remain intact.

Validation performed:

- Task validation script passed.
- Syntax checks passed.
- All 40 functional tests passed.
- `git diff --check` passed.
- No debug instrumentation remains.

Permanent tests expanded:

- Memory functional scenario now protects the specified discarded-attempt semantics and archive propagation.
- Existing task tests protect typed refinement, chained division nulls, attributed synchronous send failures, and cryptographic signature rejection.

Unresolved uncertainties:

- The latest review requests exact deduplication of discarded observations, but that directly conflicts with the selected task’s explicit prohibition on tracking identities for the discarded stream. The implementation follows the authoritative task.
- Pre-existing runner-owned task status and `workflow/runs/` changes were not modified.