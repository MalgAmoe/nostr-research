---
id: 037-bounded-session-observation
status: done
max_attempts: 4
validation: workflow/tasks/037-bounded-session-observation.validate.sh
depends_on: 036-persistent-declarative-session
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md workflow/artifacts/declarative-research-plan-field-trial.md
reviewer_sandbox: workspace-write
---

# Add bounded observation and session lifecycle commands

## Objective

Make the persistent declarative session useful for iterative research without
custom JavaScript projection.

Preserve this semantic distinction:

- `show` — what is in a named result?
- `inspect` — what is currently known about a stable subject?
- `explain` — why is a stable subject in a named result?

## Reusable presentation

Deepen `src/presentation.js` into the shared bounded projection implementation
used by both the JavaScript console and interpreter.

Do not create a second presentation vocabulary inside the interpreter.
Existing collection, acquisition, subject, corpus, set, facet, group, summary,
and plan-report values should receive concise bounded views where applicable.

Raw complete results may remain available to direct library callers, but the
interpreter never returns them by default.

## Observation commands

Add read-only commands:

- `show` with `summary` and `preview` modes;
- `inspect` for an event or account subject;
- `explain` for one subject's membership in one named result;
- `list` named result handles;
- `status` for session revision, corpus capacity/pressure, retained-set count,
  active operations, and handle count.

All accept bounded projection parameters with conservative defaults and hard
maximums. Responses report omitted/truncated counts.

`explain` returns derived membership reasons and applicable evidence
provenance. It must not invent a narrative interpretation or confuse
provenance with membership reasoning.

## Lifecycle commands

Add:

- `release` — delete only a named handle;
- `reset` — clear interpreter handles and reset memory;
- `close` — cancel owned operations, close memory, and reject later commands.

Releasing a handle never removes canonical evidence or a retained set.
Eviction remains corpus capacity policy.

Lifecycle mutations increment the revision once. Observation commands do not.
`ifRevision` applies consistently.

## Completeness and warnings

Normalize external-operation results into structural status:

```json
{
  "status": "partial",
  "completeness": {
    "requested": 24,
    "resolved": 7,
    "missing": 17,
    "boundsReached": ["timeout"]
  }
}
```

Warnings supplement this structure and are never its only representation.
Distinguish:

- command success;
- research completeness;
- session mutation;
- concurrency consistency.

An empty successful result is explicit and may produce a warning, but it is
not automatically an error.

## Boundaries

- No JSONL/stdin/stdout adapter yet.
- No algebra additions, automatic ranking/classification, persistence, UI,
  Rust, or graph runtime.
- Do not expose the JavaScript console's callback helpers through the session.
- Test through one or two public session workflows, not one unit test per
  presentation mode or error code.

## Acceptance criteria

- Named collections, groups, summaries, acquisition reports, and retained
  results have concise bounded presentation.
- `show`, `inspect`, and `explain` have distinct useful semantics.
- Observation commands never change the revision.
- `list`, `status`, `release`, `reset`, and `close` behave as specified.
- Empty and partial results are structurally observable.
- Release cannot delete corpus evidence or retained selections.
- Existing console presentation reuses the same deep module and remains
  functional.
- Functional tests and syntax checks pass.
