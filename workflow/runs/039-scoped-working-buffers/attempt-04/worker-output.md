Implemented task 039’s scoped acquisition buffers.

Deliverables changed:

- Acquisition results are named, engine-owned scoped handles.
- `select` now requires explicit acquisition or whole-corpus scope.
- Default acquisition responses are bounded and concise.
- Detailed relay/event coverage is available through `show` with `mode: "coverage"`.
- Handle replacement uses explicit `replace: true` and preserves canonical corpus evidence.
- Plan, JSONL, documentation, and existing functional scenarios use the normalized scope contract.
- Required outer-environment public-command evidence is present at `workflow/runs/039-scoped-working-buffers/manual-public-command-evidence.md`.

Validation performed:

- `sh workflow/tasks/039-scoped-working-buffers.validate.sh`
- Syntax checks passed.
- Test suite passed: 21 passed, 0 failed, 15 loopback tests skipped by sandbox policy.
- CLI help smoke check passed.
- Temporary evidence demonstrates the complete named acquisition → scoped selection → concise response → opt-in coverage → non-destructive replacement workflow.

Permanent tests added or expanded:

- No new acquisition test.
- Existing public functional scenarios were adapted to protect explicit corpus/acquisition scope and handle metadata. Network-specific verification remains temporary evidence as required.

Unresolved uncertainties:

- None. The latest review blocker was the missing evidence; that evidence is now available.