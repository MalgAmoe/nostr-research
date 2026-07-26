---
id: 044-heterogeneous-continuation-presentation
status: done
max_attempts: 4
validation: workflow/tasks/044-heterogeneous-continuation-presentation.validate.sh
depends_on: 043-judgment-and-session-ergonomics
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/composable-session-field-trial.md
reviewer_sandbox: workspace-write
---

# Correct heterogeneous continuation presentation

## Objective

Resolve the final presentation defect discovered by the task 043 JSONL field
trial: `show` on an authored/conversation continuation handle of kind
`subjects` must never return `INTERNAL_ERROR`.

## Work

- Reproduce the failure through the public declarative session boundary.
- Prefer a bounded mixed-subject projection using the existing event/account
  presentation and omission metadata.
- If a safe mixed projection is genuinely unsupported, return a stable clear
  semantic error instead of leaking an internal failure.
- Keep `show`, `inspect`, and `explain` responsibilities distinct.
- Remove any redundant special case exposed by the correction.

Do not add another view model, operation, template, transport test, or
compatibility path for unused experiments.

## Acceptance criteria

- `show` on the heterogeneous continuation result used in the milestone trial
  returns bounded evidence or a stable semantic error.
- No stack/internal implementation error crosses the session envelope.
- Existing homogeneous collection presentation remains unchanged.
- Full validation passes.

## Verification

- Permanent tests expected: no new test file or test per type; adapt the
  existing public continuation/session workflow with one assertion for this
  regression.
- Stable public behavior protected: bounded public presentation and semantic
  error envelope.
- Temporary task validation or field evidence: replay the failed task 043
  `show(authored)` command shape against deterministic resident evidence.
- Explicitly excluded test levels or mechanisms: relay-network, socket,
  transport, UI, and private helper tests.
