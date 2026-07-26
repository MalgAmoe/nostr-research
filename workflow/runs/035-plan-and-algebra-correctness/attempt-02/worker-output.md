Deliverables changed:
- Added shared retainable collection-kind validation to runtime retention and plan preflight.
- Invalid `summaries → retain` and `groups → retain` plans now fail before execution.
- Added a functional scenario proving an earlier acquisition is not started or mutated.

Validation:
- Syntax checks passed.
- Full test suite passed: 18 passed, 15 skipped.
- Task validation script passed.

Unresolved uncertainties:
- Relay-backed tests were skipped because the sandbox forbids loopback listeners. No source-level issues remain.