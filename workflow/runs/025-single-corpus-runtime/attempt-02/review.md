CHANGES_REQUIRED

1. `packages/nostr-research/src/acquire.js:183-195` records coverage only after ingestion completes, while `packages/nostr-research/src/index.js:2023-2031` requires every referenced observation to remain resident. Under capacity pressure, earlier events can be evicted before coverage is recorded, causing `ResearchMemoryError`. Coverage recording must remain valid when the same bounded acquisition evicts acquired evidence.

2. Expansion results lose relay provenance for acquired events. Assertions fail at `packages/nostr-research/test/acquisition.functional.test.js:405` and `:770`. Ensure expansion collections preserve observable acquisition provenance, including when resident-corpus pressure affects evidence.

3. The default-authored-expansion scenario at `packages/nostr-research/test/acquisition.functional.test.js:477-499` reuses the corpus populated by the preceding expansion, then incorrectly expects no authored notes to be present. Update the scenario to verify that omitting `authoredLimit` performs no authored-note acquisition without assuming previously resident evidence disappears.

4. The complete functional suite fails 4 of 27 tests, so the acceptance criterion requiring the complete suite to pass is not satisfied. After correcting the runtime and scenario issues above, `npm test` and the task validator must exit successfully.