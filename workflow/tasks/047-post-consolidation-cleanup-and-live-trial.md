---
id: 047-post-consolidation-cleanup-and-live-trial
status: done
max_attempts: 4
validation: workflow/tasks/047-post-consolidation-cleanup-and-live-trial.validate.sh
depends_on: 046-authoritative-operation-and-collection-kinds
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Simplify presentation and verify the consolidated research path

## Objective

After deleting obsolete interfaces and consolidating operation/type semantics,
remove the compensating presentation branches, documentation, exports, and
tests that no longer earn their complexity. Then repeat the live research path
which exposed the design problem.

## Work

- Review presentation and interpreter handling for branches that only
  normalize obsolete or incorrectly typed result shapes.
- Keep `show`, `inspect`, and `explain` as one deep bounded-observation module;
  do not split them into shallow presenter modules.
- Remove unreachable adapters, helpers, exports, documentation, workflow-era
  compatibility language, and duplicated schema/result-kind logic.
- Review the permanent tests under the project testing policy. Remove tests
  tied to deleted interfaces or implementation shape; retain difficult
  protocol/algorithm coverage and a small number of public functional
  workflows.
- Update the package README and `CONTEXT.md` to the reduced architecture.

## Live trial

Use the real JSONL executable with bounded public relay acquisition to repeat:

```text
orientation
  -> choose a long-tail topic
  -> account
  -> authored notes
  -> referenced accounts
  -> hydrate a bounded neighbor set
  -> followed accounts
  -> hydrate a bounded followed set
```

The trial must use handles directly after the initial research choice. Record
exact commands, bounded results, friction, and whether any dynamic JavaScript
or manual stable-ID extraction was needed in:

`workflow/artifacts/consolidated-navigation-field-trial.md`

## Acceptance criteria

- The package exposes one coherent research path: memory, normalized
  operations, declarative session, and JSONL adapter.
- Presentation contains no special cases required solely by deleted
  interfaces or false generic typing.
- The permanent suite is smaller or more focused without losing stable
  protocol/algorithm and public workflow coverage.
- The complete live trial succeeds through named handles.
- No dynamic JavaScript or manual ID copying performs research operations.
- Full validation passes and the repository is clean.

## Verification

- Permanent tests expected: no new tests unless an independently identified
  stable public regression remains uncovered.
- Stable public behavior protected: existing reduced public workflows.
- Temporary task validation or field evidence: the bounded live trial.
- Explicitly excluded test levels or mechanisms: UI, screenshots,
  implementation snapshots, tests per command, and permanent live-relay tests.
