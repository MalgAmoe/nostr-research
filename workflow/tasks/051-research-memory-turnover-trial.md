---
id: 051-research-memory-turnover-trial
status: ready
max_attempts: 4
validation: workflow/tasks/051-research-memory-turnover-trial.validate.sh
depends_on: 050-reference-resolved-research-views
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Validate research continuity across complete buffer turnover

## Objective

Exercise the integrated buffer, archive, notebook, views, declarative session,
and JSONL adapter as one research system. Remove superseded storage and
presentation code revealed by the trial.

## Work

- Perform the complete milestone acceptance scenario from
  `workflow/artifacts/research-memory-milestone.md`.
- Use the real JSONL executable. Deterministic events may establish exact
  turnover behavior; use a bounded live relay phase where network access is
  available to judge actual research ergonomics.
- Conduct an iterative investigation:
  - acquire and orient;
  - select candidates;
  - record both positive and negative notebook knowledge;
  - preserve a small amount of exact and excerpt evidence;
  - completely replace the observation buffer;
  - continue research from notebook knowledge and archive evidence;
  - direct another acquisition without manual stable-ID extraction;
  - release selected evidence and inspect the resulting resolution change.
- Record commands, judgments, evidence sources, completeness, friction, and
  approximate counts or serialized sizes of buffer, archive, notebook, and
  named views in:

  `workflow/artifacts/research-memory-turnover-field-trial.md`

- Review the implementation after the trial and delete:
  - superseded retention, annotation, ingest-preserve, or copied-evidence code;
  - unreachable presentation and lifecycle branches;
  - outdated documentation and exports;
  - permanent tests tied only to removed implementation shapes.
- Update `CONTEXT.md`, package documentation, and `workflow/ROADMAP.md` to
  describe only the final model.

Do not add new storage concepts merely to make the trial pass. Report genuine
remaining limitations.

## Acceptance criteria

- Research can continue coherently after complete buffer turnover.
- Preserved evidence, notebook knowledge, and working views have distinct and
  observable ownership and lifecycle.
- Later acquisition can be directed from prior research knowledge through
  named handles, without dynamic JavaScript or manual ID copying.
- Archive, buffer, notebook, and view sizes are visible enough to detect
  accidental duplication.
- The field artifact distinguishes system capability from researcher judgment
  and reports unresolved evidence honestly.
- The final package contains no parallel old/new storage semantics.
- Full validation passes with a focused permanent suite.

## Verification

- Permanent tests expected: no new tests unless the integrated trial reveals a
  stable public regression not covered by tasks 048-050.
- Stable public behavior protected: the final coherent memory, operation,
  session, and JSONL workflow.
- Temporary task validation or field evidence: the deterministic turnover
  scenario and bounded live investigation recorded in the artifact.
- Explicitly excluded test levels or mechanisms: permanent live-relay tests,
  WebSocket/TCP tests, UI, screenshots, persistence, implementation snapshots,
  and tests per command or storage method.
