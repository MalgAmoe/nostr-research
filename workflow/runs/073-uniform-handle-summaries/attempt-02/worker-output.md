Implemented the requested size-limit fix.

Deliverables changed:
- `presentation.js`: summary fallbacks now enforce byte limits, preserve the factual core, compact oversized fields, and report explicit presentation omissions.
- Functional test: added a public session-boundary regression covering an oversized summary at a 1,000-byte limit.

Validation performed:
- Syntax checks passed.
- Full task validation passed.
- 33 tests passed.

Permanent test justification:
- Protects the stable public summary contract and confirms bounded output without testing private helpers or exact snapshots.

Unresolved uncertainties: none.