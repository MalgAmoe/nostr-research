Implemented both review findings.

Deliverables changed:
- Normalized canonical subject failures, including invalid `naddr` kinds, to `InvalidNostrReferenceError`.
- Expanded inspect/explain schema text with accepted entities and unverified, non-routing hint semantics.
- Updated functional schema expectations and reference rejection coverage.

Validation:
- Syntax checks passed.
- Complete functional suite passed: 22/22.
- `git diff --check` passed.

Permanent tests:
- Expanded public-boundary reference test to protect predictable rejection of decodable but non-canonical addresses.
- Expanded schema contract test to protect factual reference and hint documentation.

Unresolved uncertainties: none.