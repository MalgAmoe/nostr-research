Implemented task 040 and addressed all review findings.

Deliverables changed:

- Aligned advertised pipeline fields with runtime support for `subject` and `event.tag`.
- Preserved complete derived aggregation inputs, reasons, and provenance across per-group truncation.
- Added per-aggregation completeness and omission metadata.
- Recorded two executed declarative field-trial replays with bounded outputs and provenance.
- Expanded the public collection-algebra functional suite.

Validation:

- `git diff --check`: passed.
- Task validator: passed.
- Full suite: 25 passed, 0 failed, 15 skipped because loopback listeners are sandbox-restricted.

Permanent tests expanded:

- Public schema fields execute successfully through projection and sorting.
- Bounded groups produce complete `distinct`, `min`, `max`, and collection aggregations with explicit completeness metadata.
- These protect stable public pipeline semantics that temporary replay evidence cannot adequately freeze.

Unresolved uncertainties:

- None. Sandbox-skipped network tests were explicitly outside this task’s verification scope.