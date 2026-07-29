BLOCKED

The previous substantive finding remains. In `packages/nostr-research/src/memory.js`, `omittedObservationKeys` retains only 100 identities and discards older ones with `shift()`. After 101 distinct omitted observations, re-ingesting the first omitted observation increments `omittedObservationCount` again, so identical observations are still not reliably deduplicated.

Resolving exact deduplication for an unbounded observation stream while keeping all memory bounded requires a product/design decision about approximation or omission-count semantics. Per the review policy, this repeated finding must be reassessed rather than sent through another mechanical implementation attempt.