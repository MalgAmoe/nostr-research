Implemented task 050.

Deliverables changed:

- Reference-resolved relation fields backed by archive/buffer resolution.
- Handles now retain provenance references instead of observation copies.
- Bounded scan excerpts and coordinates replace `match.value`.
- Aggregate samples/collections expose truncation metadata.
- Fetch/expand resolve referenced fields at execution time.
- Predictable `show` window metadata, including `nextOffset` and size omissions.
- Updated documentation.
- Added public functional coverage for resolution transitions, scans, aggregates, joins, and pagination.

Validation:

- Task validator passed.
- 22/22 functional tests passed.
- `git diff --check` passed.
- Temporary size check: 40,693-byte source evidence produced a 4,946-byte relation both before and after turnover; resolution changed to `unresolved`.

Permanent tests added/expanded:

- Added `reference-resolved-views.functional.test.js`, protecting the stable public relation algebra and bounded observation behavior.
- Removed one obsolete assertion expecting copied profile data in an internal relation row.

Unresolved uncertainties: none. Existing workflow task/run changes were left untouched.