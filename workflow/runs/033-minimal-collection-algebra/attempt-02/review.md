CHANGES_REQUIRED

1. Group-stage outputs are not reusable. `applyGroup()` returns a `typed-collection`, but `asCollection()` rejects that shape. Therefore `transform(transform(events, groupStage), summarizeStage)` fails, violating inspectable, composable stages. Accept and validate typed collection outputs at the public algebra boundary.

2. `asCollection()` re-resolves result items through `#resolveCollectionItem()` and discards their existing `provenance`. This loses applicable source evidence after moves or prior transformations. Preserve and merge the incoming provenance when re-resolving collections, and add functional coverage for provenance across separately invoked stages.