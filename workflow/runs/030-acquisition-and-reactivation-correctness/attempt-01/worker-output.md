Implemented task 030.

Deliverables changed:

- Enforced exact NIP-01 filter matching with `nostr-tools`.
- Added per-relay and aggregate `nonMatching` diagnostics.
- Shared distinct-event accounting across composed expansion and reply-context requests.
- Rejected unknown direct-acquisition options before networking.
- Unified retained-summary/full-set conversion for explicit session activation.
- Added functional coverage for filtering, composed budgets, option validation, reactivation, and evicted evidence.
- Updated README and canonical context.

Validation:

- `npm run check` passed.
- `npm test` passed: 13 passed, 12 loopback tests skipped because this sandbox forbids listeners.
- Task validation script passed.
- `git diff --check` passed.
- No obsolete acquisition option remains in active source/docs.

Unresolved uncertainties:

- Loopback scenarios could not execute in this sandbox; they remain available for runner/reviewer validation.