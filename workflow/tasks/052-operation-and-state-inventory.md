---
id: 052-operation-and-state-inventory
status: ready
max_attempts: 4
validation: workflow/tasks/052-operation-and-state-inventory.validate.sh
depends_on: 051-research-memory-turnover-trial
protected_paths: workflow/run.py workflow/prompts packages/nostr-research/src packages/nostr-research/test
reviewer_sandbox: workspace-write
---

# Inventory operations, state ownership, and seam failures

## Objective

Create the factual map needed to simplify the research system without
accidentally removing useful composability or preserving duplicate machinery.
This task is analysis only: do not refactor or repair product code.

Use `docs/research/system-simplification-direction.md` and
`docs/research/system-simplification-plan.md` as the active direction. Treat
documents under `docs/research/archive/` as field evidence, not current policy.

## Work

- Inventory every public and internal research operation.
- For every operation record:
  - researcher intention;
  - accepted input and produced output kinds;
  - local or external execution;
  - read-only or mutating behavior;
  - normalization, validation, preflight, and execution locations;
  - direct, plan, session, presentation, and test callers;
  - overlap with other operations;
  - a reasoned keep, merge, lower, rename, or remove recommendation.
- Map ownership and lifecycle of:
  - observation-buffer evidence;
  - archived evidence;
  - notebook knowledge;
  - subject collections;
  - research relations;
  - acquisition reports;
  - session handles.
- Trace these reported seams to concrete code paths and classify each as
  confirmed, obsolete, or not reproducible:
  - mixed conversation to authors;
  - inconsistent `event.hasMedia`;
  - collection versus relation pagination;
  - scan rows versus distinct events and authors;
  - multi-input retrieval starvation;
  - incomplete operation/schema guidance;
  - PTY command echo interleaving.
- Identify duplicate helpers, operation registries, validation switches, and
  presentation rules.
- Record the existing public functional baseline without changing it.

Write the result to:

`workflow/artifacts/operation-and-state-inventory.md`

## Acceptance criteria

- The artifact accounts for every operation exposed by the package, plans, or
  persistent session.
- It distinguishes collection, relation, acquisition-report, memory, and
  session responsibilities.
- Every recommendation cites the current implementation and current callers.
- Known seam problems have concrete evidence and an owner.
- The artifact proposes clear boundaries for Tasks 053 and 054 without
  inventing another architectural layer.
- Product source and permanent tests are unchanged.

## Verification

- Permanent tests expected: no.
- Stable public behavior protected: the existing package check and functional
  suite establish the baseline without new tests.
- Temporary task validation or field evidence: artifact completeness checks,
  source inventory comparison, `npm run check`, and `npm test`.
- Explicitly excluded test levels or mechanisms: new permanent tests,
  live-relay tests, WebSocket/TCP tests, UI, screenshots, and product fixes.
