CHANGES_REQUIRED

1. Public field schema accepts unusable fields. `PIPELINE_FIELDS` advertises `subject` and `event.tag` for projection, distinct, and sorting (`src/index.js:1592-1596`), while `transformField()` cannot resolve either and throws at execution (`src/index.js:2053-2071`). Align validation/schema with runtime behavior so every discoverable accepted field executes successfully.

2. Grouped aggregation can silently return incomplete results. Per-group truncation discards members, reasons, and provenance (`src/index.js:2084-2098`), then `distinct`, `min`, and `max` aggregate only retained members (`src/index.js:2116-2160`) without reporting that those values may be incomplete. Preserve sufficient derived inputs/provenance or explicitly report omissions for every affected aggregation.

3. The field-trial artifact does not demonstrate two actual replays. It only lists command shapes against assumed named inputs and provides no executed results or validation evidence (`workflow/artifacts/040-composable-collection-pipeline-replays.md:1-40`). Replay both documented reductions through declarative commands and record bounded outputs/omission metadata.