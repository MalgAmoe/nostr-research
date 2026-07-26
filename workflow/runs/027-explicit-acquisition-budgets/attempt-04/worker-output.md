Implemented the review fix.

- Changed expansion stopping precedence so equal observation/distinct-event limits report `observation-budget`, consistent with acquisition and reply contexts.
- Added public functional coverage for equal expansion budgets.
- Passed `git diff --check`, syntax checks, and full validation: 16 passed, 0 failed.
- 10 relay tests were skipped because this sandbox forbids loopback listeners; no other uncertainties.