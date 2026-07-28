Implemented task 059.

Deliverables changed:

- Added bounded NIP-27 inline reference derivation using the existing decoder.
- Added typed account, event, and address navigation relationships.
- Preserved exact token offsets, decoded hints, source evidence, and provenance.
- Integrated edges with existing move, traversal, continuation, inspection, and relation extraction paths.
- Updated README and protocol capability map.
- Extended the public-boundary protocol/navigation functional test.

Validation:

- Syntax checks passed.
- Complete functional suite passed: 23/23.
- `git diff --check` passed.

Permanent tests expanded:

- Extended the protocol relationship functional scenario to protect NIP-27 recognition, typed navigation, evidence explanation, deterministic deduplication, false-match rejection, conversation isolation, continuation, and relation extraction. A permanent test is justified because these are stable public protocol/navigation semantics.

Unresolved uncertainties: none.