# Repository workflow

This directory is the durable memory for rebuilding the project around a
UI-independent Nostr research library.

The current application remains the reference implementation during the first
milestone. Workflow tasks may inspect it, but they must not move or rewrite it
unless a later task explicitly authorizes that work.

## Operating model

1. `run.py` selects the first task whose status is `ready` or `in_progress`.
2. A fresh Codex worker receives the workflow rules, canonical `CONTEXT.md`
   when present, the task, and the latest review.
3. The task's validation script runs.
4. A fresh read-only Codex reviewer receives the same canonical context and
   evaluates the work against the task's acceptance criteria and validation
   output.
5. `PASS` marks the task `done`.
6. `CHANGES_REQUIRED` starts another attempt and gives the worker the review.
7. `BLOCKED` stops the task for human discussion.

The runner, not either Codex invocation, owns task status.

Worker or reviewer process failures are infrastructure failures, not failed
task attempts. The runner stops immediately and marks the task `blocked` with
the captured process log; it never burns through the review-attempt budget by
blindly retrying the same broken command.

## Repository layout

```text
workflow/
  WORKFLOW.md
  run.py
  tasks/       editable task queue
  prompts/     stable worker and reviewer instructions
  artifacts/   durable deliverables
  runs/        prompts, outputs, validation, and reviews per attempt
```

The intended later repository shape is:

```text
apps/reference-client/      packaged reference client
packages/nostr-research/    clean UI-independent library
workflow/                   persistent agent workflow
```

The application is not moved until an inventory task has passed review.

## Task format

Tasks are Markdown files with a small editable front matter:

```text
---
id: 001-inventory
status: ready
max_attempts: 4
validation: workflow/tasks/001-inventory.validate.sh
depends_on:
protected_paths: src server.mjs index.html vite.config.js package.json package-lock.json
---
```

Supported statuses are `ready`, `in_progress`, `done`, and `blocked`.
Dependencies are optional comma-separated task IDs. Tasks are processed in
filename order.

`protected_paths` is an optional space-separated list. The runner fingerprints
those files before and after every worker attempt and fails validation if the
worker changes them, even when the worktree was already dirty.

## Safety and completion

- Workers may only make changes permitted by the selected task.
- Reviewers are read-only and never repair the work they review.
- Product-code changes are forbidden unless a task explicitly permits them.
- Validation success is necessary but not sufficient.
- A successful Codex process is not evidence that a task is complete.
- Review output must begin with `PASS`, `CHANGES_REQUIRED`, or `BLOCKED`.
- The runner stops when the maximum attempt count is reached.
- Process failures stop immediately instead of entering the review loop.
- `CONTEXT.md` is durable project context and is injected into every worker and
  reviewer prompt once it exists.
- Git staging and commits remain manual.

## Running

Run one queued task:

```sh
python3 workflow/run.py --max-tasks 1
```

Preview task selection without invoking Codex:

```sh
python3 workflow/run.py --dry-run
```
