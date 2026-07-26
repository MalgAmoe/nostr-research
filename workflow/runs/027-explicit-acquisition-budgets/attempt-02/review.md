CHANGES_REQUIRED

1. `packages/nostr-research/src/expansion.js:77` builds relay filter limits using only the distinct-event remainder, ignoring the smaller observation remainder. This produces authored filter limits `[2, 2]` instead of `[2, 1]` and reply breadth `100` instead of `12`. Bound filter limits by both remaining budgets while preserving per-account authored distinct limits.

2. The required validation fails: 2 of 26 functional tests fail at `acquisition.functional.test.js:522` and `:923`. All functional tests must pass before acceptance.