---
id: 054-memory-and-result-ownership
status: done
max_attempts: 5
validation: workflow/tasks/054-memory-and-result-ownership.validate.sh
depends_on: 053-unified-operation-model-and-executor
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Clarify memory and result ownership

## Objective

Make state ownership and result lifetimes obvious while reducing the mixed
responsibilities in `src/index.js`. Keep the existing process-local model and
avoid creating a framework of shallow storage abstractions.

## Work

- Make the research memory clearly own:
  - canonical evidence and observation-buffer bounds;
  - buffer eviction;
  - deliberate archive retention and release;
  - stable-subject resolution;
  - notebook knowledge;
  - only the indexes required to retrieve that state.
- Move analytical transformations behind the authoritative executor rather
  than treating them as memory responsibilities.
- Make collections and relations explicit result values over explicit inputs.
- Keep session handles as references to engine-owned values; do not duplicate
  the corpus in command state.
- Make acquisition writes, local reads, handle release, archive release,
  notebook survival, and reset behavior unambiguous.
- Fix confirmed ownership-adjacent failures from the inventory, including
  pagination, distinct counts, media fields, mixed-subject navigation, or
  multi-input starvation where their actual owner lies in this task.
- Simplify large modules internally only where the new ownership boundary
  provides a cohesive extraction. Do not create one file or class per method.
- Update active documentation and remove superseded storage terminology.

## Acceptance criteria

- Observation buffer, archive, notebook, working results, and handles have
  distinct and observable ownership and lifecycle.
- Local operations never fetch silently.
- Releasing a handle does not erase evidence; releasing archive evidence does
  not erase notebook knowledge.
- Collections and relations do not become hidden copies of memory.
- `src/index.js` has fewer unrelated responsibilities, with no increase in
  public architectural concepts.
- Confirmed seam failures assigned to this boundary are repaired and verified
  through public behavior.
- Existing turnover behavior remains coherent.

## Verification

- Permanent tests expected: adapt or consolidate public functional memory,
  turnover, and navigation coverage; add no tests for private extraction
  boundaries.
- Stable public behavior protected: buffer/archive/notebook lifecycle,
  reference resolution, handle release, reset, pagination, and representative
  multi-input navigation.
- Temporary task validation or field evidence: deterministic turnover and
  starvation scenarios using the public interface.
- Explicitly excluded test levels or mechanisms: storage-method unit tests,
  live-relay tests, WebSocket/TCP tests, persistence, UI, screenshots, and
  implementation snapshots.
