Deliverables changed:

- Fixed acquisition-report discovery to recommend only executable `select`, with acquisition-scoped constraints.
- Implemented all five observation modes for typed comparison/summary collections.
- Expanded the public declarative-session functional workflow to cover typed-result observation behavior.

Validation performed:

- Full task validation passed: 16 tests.
- Focused declarative observation tests passed.
- Acquisition discovery assertion passed.
- `git diff --check` passed.

Permanent tests expanded:

- Typed comparison observation workflow, protecting consistent public `summary`, `coverage`, `details`, and `explain` envelopes. Temporary validation was insufficient because this is stable session behavior identified by independent review.

Unresolved uncertainties: none.