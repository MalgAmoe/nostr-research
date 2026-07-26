Implemented task 041.

Deliverables changed:

- Added typed `continue` operation for named handles.
- Covered all required relationship types, local and relay-backed.
- Added bounded budgets, completeness reporting, per-input omissions, and traversal provenance.
- Integrated continuation into declarative commands and research plans.
- Documented the new API.
- Added one deterministic functional continuation scenario.

Validation:

- Task validation passed.
- Full suite: 26 passed, 15 network-dependent tests skipped, 0 failed.
- Syntax and diff checks passed.

Permanent test added:

- Protects named account/note handle continuation, authored-note and conversation semantics, completeness, and `explain` provenance.
- A permanent functional test was appropriate because these are stable public-boundary behaviors explicitly required by the task.

Unresolved uncertainty:

- Live relay account-to-conversation validation was not possible in the restricted sandbox; relay-backed behavior remains covered by existing acquisition infrastructure and validation.