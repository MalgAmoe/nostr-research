CHANGES_REQUIRED

1. `normalizeRun()` in `packages/nostr-research/src/index.js:996` accepts arbitrary `inputs` and merely JSON-clones them at line 1042. Normalize and validate inputs according to the selected operation so recorded runs actually preserve normalized public acquisition/event-query/account-query inputs.

2. `expandSet()` in `packages/nostr-research/src/index.js:474` accepts any non-empty relationship string. A typo or unsupported relationship silently creates an empty set. Validate requested types against the observable navigation relationship types and return a useful error before creating the destination set.

3. Acquisition recording in `packages/nostr-research/bin/nostr-research-memory.js:207` obtains provenance using `memory.getEvent(id)`, which includes every historical observation for that event, including observations unrelated to the recorded acquisition. Preserve the observations produced by this acquisition and attach only those to its run results so provenance accurately explains what happened in that run.