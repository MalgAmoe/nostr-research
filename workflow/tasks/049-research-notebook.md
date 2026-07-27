---
id: 049-research-notebook
status: done
max_attempts: 4
validation: workflow/tasks/049-research-notebook.validate.sh
depends_on: 048-deliberate-evidence-preservation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Consolidate explicit research knowledge in one notebook

## Objective

Give provisional interpretation and navigation knowledge one coherent owner.
The notebook must retain what the researcher learned without pretending that
subject membership or judgment preserves the underlying Nostr evidence.

## Work

- Replace the separate annotation map and retained-set implementation with one
  memory-owned research notebook following
  `workflow/artifacts/research-memory-milestone.md`.
- Support the useful existing actions through the coherent model:
  - interested, uninterested, uncertain, and anchor judgments;
  - optional strength, labels, and researcher-authored notes;
  - named subject membership with reasons and source references;
  - explicitly recorded bounded derived observations or summaries when a
    caller chooses to remember them.
- Keep notebook statements attributed and provisional. Do not infer, train,
  score, or automatically record every result.
- Make notebook queries usable as ordinary inputs to filtering, joining,
  explanation, and later relay-directed acquisition.
- Keep evidence preservation orthogonal:
  - notebook membership must not archive an event;
  - archiving evidence must not silently create a judgment;
  - deleting either must not silently delete the other.
- Provide a concise declarative/session lifecycle for listing, inspecting,
  replacing, and deleting notebook entries or named membership.
- Remove superseded annotation/set shapes, lifecycle branches, presentation,
  exports, documentation, and tests. There is no compatibility requirement.

## Acceptance criteria

- Notebook knowledge survives complete observation-buffer turnover.
- Positive and negative judgments and named candidate membership can direct a
  subsequent local or relay-backed operation without manual ID copying.
- Every notebook entry exposes its subject, kind, reason, attribution, and
  source references without claiming that referenced evidence is resolved.
- Notebook and archive lifecycles are independent and unambiguous.
- Existing research actions remain expressible with a smaller conceptual
  surface than annotations plus retained sets.
- No universal quality model, automatic classifier, persistence layer, or
  event duplication is added.

## Verification

- Permanent tests expected: yes, extend one public declarative-session
  workflow to protect notebook judgment, named membership, evidence
  independence, and use as a later operation input.
- Stable public behavior protected: provisional judgments, explainable
  membership, named result/session lifecycle.
- Temporary task validation or field evidence: deterministic acquire,
  remember, turn over, and reacquire scenario.
- Explicitly excluded test levels or mechanisms: tests per notebook command,
  internal map shape, scoring/classification tests, live relay transport, UI,
  persistence, and compatibility tests for removed annotation/set APIs.

## Reassessment after attempt 2

The repeated review finding is now diagnosed precisely and is narrower than
the original cleanup wording:

- remove the obsolete public retained-selection subject/value shape
  `type: "set"`, `isResearchSet()`, and `showSet()` presentation path;
- replace `sets`/`set` wording that remains in validation errors for the new
  `memberships` and `membership` commands;
- remove stale retained-selection language from the canonical context;
- preserve legitimate mathematical set operations, JavaScript `Set` usage,
  aggregation terms such as retained sample count, and ordinary English uses
  of “set” which are not the removed research-set model.

This changed diagnosis justifies one further worker/reviewer attempt. It does
not reopen the notebook model or ask for another compatibility layer.
