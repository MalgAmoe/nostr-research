Implemented truthful relation cardinality and bound accounting.

Deliverables changed:

- Relation operations now report factual row accounting and proven truncation.
- Filtering, deduplication, aggregation, slicing, balancing, joins, scans, and explosions expose operation-specific facts.
- `omittedCount` is only emitted when exact limit omission is known.
- Accounting is preserved through relation contexts, schemas, session handles, `show summary`, and `show coverage`.
- Public accounting contract documented in the package README.

Validation:

- `npm run check` passed.
- Full `npm test` passed: 32/32 tests.
- `git diff --check` passed.
- Task validation script passed.

Permanent tests expanded:

- Public relation/session functional coverage now protects the 160-to-100 explode truncation case, exact-limit non-truncation, filter rejection semantics, aggregation collapse semantics, and named-handle accounting visibility.
- Existing relation-summary coverage was updated for the newly public initial cardinality facts.

Unresolved uncertainties: none.