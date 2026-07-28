Implemented the minimal browser Worker adapter.

Deliverables created or changed:

- Added `@nostr-research/memory/browser-worker` package entry.
- Added single-memory, single-session Worker lifecycle and initialization protocol.
- Preserved unchanged declarative-session command responses, cancellation, and closure behavior.
- Added Worker protocol documentation beside the JSONL adapter.
- Added temporary Worker-global validation harness.
- Added browser Worker proof artifact.

Validation performed:

- Syntax checks passed.
- Complete functional suite passed: 23/23.
- Worker import restrictions passed.
- Worker shim lifecycle and JSON round-trip proof passed.
- `git diff --check` passed.

Permanent tests added or expanded: none, per task testing policy.

Unresolved uncertainties:

- Actual Safari/browser execution remains unverified until browser automation is configured.
- Bundler/package-subpath URL handling remains embedding-application specific.