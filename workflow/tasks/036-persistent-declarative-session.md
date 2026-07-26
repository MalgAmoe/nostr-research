---
id: 036-persistent-declarative-session
status: done
max_attempts: 4
validation: workflow/tasks/036-persistent-declarative-session.validate.sh
depends_on: 035-plan-and-algebra-correctness
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Add the persistent declarative research session

## Objective

Create the in-process interpreter foundation which gives agents persistent,
named access to the existing declarative algebra without executing arbitrary
code.

This is not the JSONL adapter and not the observation/presentation task. It is
the reusable session and command protocol underneath those adapters.

## Shared operation execution

Deepen the current plan module so individual interpreter commands and named
plans use one normalized operation representation and one execution path.

- Extract or expose the smallest shared preflight/execution capability needed
  by both callers.
- Do not duplicate filter, group, summarize, move, acquisition, hydration, or
  retention semantics in the interpreter.
- Preserve complete preflight before external effects.
- Preserve existing valid named-plan behavior and reports.

## Interpreter-owned state

Add a focused module, preferably `src/interpreter.js`, which owns:

- one open bounded research memory supplied by its caller;
- engine-owned named result handles;
- a non-negative integer session revision;
- command validation and dispatch;
- active external-operation cancellation;
- close behavior.

Named result handles are not copied canonical datasets. Subject collections
remain stable subject/reason references whose evidence resolves through memory.
Typed group/summary results remain bounded engine-owned results.

A public handle reports only concise metadata:

```json
{"id":"authors","kind":"accounts","count":24,"revision":18}
```

Reject duplicate result IDs unless the command explicitly requests
replacement. Replacing or releasing a handle is interpreter-state mutation.

## Stable command envelope

Accept plain JSON commands containing:

- caller-owned non-empty `commandId`;
- optional non-negative `ifRevision`;
- `command`;
- command-specific plain-data fields.

Return exactly one plain-data response:

```json
{
  "ok": true,
  "commandId": "c17",
  "sessionRevision": 42,
  "result": {},
  "warnings": []
}
```

or:

```json
{
  "ok": false,
  "commandId": "c17",
  "sessionRevision": 42,
  "error": {
    "code": "UNKNOWN_RESULT",
    "message": "...",
    "details": {}
  }
}
```

Initial stable error codes:

- `INVALID_COMMAND`
- `INVALID_OPERATION`
- `UNKNOWN_RESULT`
- `DUPLICATE_RESULT`
- `INVALID_SUBJECT`
- `TYPE_MISMATCH`
- `REVISION_CONFLICT`
- `SESSION_CLOSED`
- `INTERNAL_ERROR`

Expected bounded relay/hydration incompleteness is not a command error.

## Initial research commands

Support the existing operation vocabulary:

- `acquire`
- `select`
- `filter`
- `group`
- `summarize`
- `move`
- `hydrate`
- `retain`
- complete named `plan`

Commands consuming results name their input handle. Result-producing commands
may supply a result ID. Plans expose selected stage outputs as handles without
changing plan-stage semantics.

## Revision invariant

- Successful commands increment revision once when they mutate corpus,
  retained memory state, or named handles.
- Read-only commands do not increment revision.
- A failed command leaves interpreter-owned state, memory, and revision
  unchanged.
- `ifRevision` conflicts fail before execution.
- An external operation which encountered bounded partial relay outcomes
  returns `ok: true` with structured completeness; it is not converted into an
  error.

Use preflight and the existing bounded external-operation reporting to uphold
the failed-command invariant. Do not create a corpus snapshot/rollback system.

## Boundaries

- No stdin/stdout, JSONL, browser adapter, UI, persistence, Rust, DSL, plugin,
  or automatic judgment.
- Do not add algebra operations.
- Do not merge this session with the JavaScript console's active-selection
  `ResearchSession`; they have different responsibilities.
- Do not expose arbitrary callbacks or executable strings.
- Add one public functional scenario covering command envelopes, handles,
  revision behavior, replacement, preflight failure, and partial external
  outcomes. Avoid per-command unit tests.

## Acceptance criteria

- Plans and interactive commands demonstrably share normalization/execution.
- Named handles persist across commands and do not duplicate canonical
  evidence ownership.
- Stable response envelopes and semantic error codes are returned.
- `ifRevision` and mutation-only revisions behave predictably.
- Failed commands leave memory, handles, and revision unchanged.
- Partial external outcomes are successful commands with structured status.
- No supplied executable code is accepted.
- Existing plan, algebra, console, and functional behavior remains intact.
- Functional tests and syntax checks pass.
