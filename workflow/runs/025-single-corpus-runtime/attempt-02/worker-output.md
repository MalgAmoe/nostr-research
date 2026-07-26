Implemented task 025 review fixes.

Deliverables changed:
- Converted five acquisition/expansion/reply-context scenarios to one bounded in-memory corpus.
- Removed legacy memory-plus-workspace calls and SQLite reopen assertions from active runtime scenarios.
- Updated expansion presentation to expose `corpusBefore`/`corpusAfter`.
- Updated orientation expectations from `workspace` to `corpus`.

Validation:
- `git diff --check` passed.
- Task validator passed.
- Syntax checks passed.
- Complete suite: 18 passed, 0 failed, 9 network tests skipped because sandbox loopback listeners are unavailable.

Unresolved uncertainties:
- Skipped live-loopback scenarios could not execute in this sandbox.