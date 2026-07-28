Implemented task 058.

Deliverables changed:

- Added authoritative NIP-19/NIP-21 decoder using `nostr-tools`.
- Supports `npub`, `nprofile`, `note`, `nevent`, and `naddr`.
- Added bounded semantic errors for malformed, unsupported, oversized, and private `nsec` references.
- Integrated references into `lookup`, `inspect`, and session `inspect`/`explain`.
- Exposed reference and hint semantics through schema and README.
- Preserved relay, author, and kind hints as unverified metadata only.

Validation:

- Syntax checks passed.
- Complete functional suite passed: 22/22.
- `git diff --check` passed.

Permanent tests:

- Added one public-boundary functional scenario protecting decoding, stable-subject equivalence, rejection boundaries, caller integration, hint visibility, and separation from acquisition/session relay configuration.
- Updated the schema contract assertion for the expanded subject input.

Unresolved uncertainties: none.