Deliverables created or changed:
- Added executable `nostr-research-session` JSONL adapter with persistent session state and clean shutdown.
- Added process-boundary functional workflow covering correlation, revisions, handles, bounded observations, lifecycle, malformed JSON, and EOF.
- Documented executable, protocol envelopes, commands, lifecycle, bounds, and errors.
- Recorded three live investigations and evidence-based verdict.
- Corrected relay failures being incorrectly reported as complete without warnings.
- Added package executable and root script entries.

Validation performed:
- `npm run check` passed.
- `npm test` passed: 21 passed, 16 network tests skipped because loopback listeners are unavailable.
- Task validation script passed.
- `git diff --check` passed.
- Explicit close and EOF exited cleanly.

Unresolved uncertainties:
- Public relay DNS was unavailable, so live trials exercised empty/error/pivot behavior but could not capture positive live relay evidence. A future network-enabled trial should verify rich evidence navigation.