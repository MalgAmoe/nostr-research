CHANGES_REQUIRED

1. In `packages/nostr-research/src/memory.js`, identical observations are deduplicated only while retained. Once the 100-entry limit is reached, repeating the same omitted observation increments `omittedObservationCount` every time because omitted facts are not tracked for deduplication. Genuinely identical observations must remain deduplicated after the bound is reached without introducing unbounded state.

2. Canonical preservation of account metadata in `preserve()` copies only `event` and `observations`, dropping `omittedObservationCount`. The omission fact therefore does not survive the canonical account archive path. Include the omission count in that canonical record and cover this public path in the existing memory/archive functional scenario.