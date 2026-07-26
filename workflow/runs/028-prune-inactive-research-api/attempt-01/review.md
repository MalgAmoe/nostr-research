CHANGES_REQUIRED

1. `packages/nostr-research/src/presentation.js:189` and `:210` still present acquisition coverage as an ID-bearing record (`coverage.id` / `value.id`). Direct coverage no longer has an ID, so presentation emits `id: undefined`, leaving a dormant compatibility branch from the removed registry. Remove the record-ID presentation.

2. `packages/nostr-research/src/acquire.js:231` reduces each coverage observation to `eventId`, `observationId`, and `observedAt`, omitting its relay. This makes the standalone `result.coverage` insufficient to identify where each observation came from, contrary to complete direct attempt coverage. Preserve the observation’s relay in `coverage.observedEvents` and validate it functionally.