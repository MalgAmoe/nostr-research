CHANGES_REQUIRED

1. The concise acquisition envelope reports raw ingestion occurrences, not distinct subjects (`packages/nostr-research/src/interpreter.js:544-546`). Because `additions.refreshed` is appended for every duplicate observation, one subject may be counted multiple times or counted as both added and refreshed. Deduplicate event IDs and report mutually meaningful distinct added/refreshed subject counts.

2. Relay completeness labels every requested relay as `attempted` (`packages/nostr-research/src/interpreter.js:527-530`), although acquisition records `contacted: false` for relays never started after an operation-wide bound is reached. Compute attempted/completeness counts from the recorded contact state so the concise summary does not misstate relay coverage.