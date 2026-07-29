Implemented task 076.

Deliverables changed:

- Unified acquisition timeout maximum (60,000 ms) and concurrency maximum (10) across acquire, hydrate, fetch, and relay continuation.
- Published constraints and 100-stage plan limit through global/contextual schema.
- Added explicit semantic codes for capacity exhaustion, unknown memberships, unresolved evidence, and lineage mismatch.
- Merged canonical archive aliases by event ID while preserving unique observations.
- Separated buffer residency from preferred archive resolution.
- Added lineage-aware extraction validation.
- Added typed size-bounded fallback for coverage observations.
- Documented plan rollback and irreversible external-contact behavior.
- Updated README and focused functional tests.

Validation:

- Task validator passed.
- Syntax checks passed.
- All 41 functional tests passed.
- JSONL adapter manually verified for schema constraints and semantic error envelopes.
- `git diff --check` passed.
- Browser smoke was attempted but Chromium launch was blocked by the managed macOS sandbox’s Mach-port permission; no product assertion ran.

Permanent tests expanded:

- Contract/schema scenario: protects shared acquisition maxima, plan bounds, and lineage-aware extraction while retaining generic extraction.
- Archive scenario: protects observation union across aliases, independent residency, and unknown-membership codes.
- Acquisition scenario: protects typed omission axes under aggressive response-size bounding.

Unresolved uncertainties:

- Browser smoke remains unexecuted due solely to the sandbox launch restriction. No changes were staged or committed.