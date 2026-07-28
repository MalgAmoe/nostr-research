Implemented normalized event attachments and composable media facts.

Deliverables changed:

- Added NIP-92, NIP-94, picture/video/voice kinds, podcast audio, and URL inference normalization.
- Added bounded attachment merging, classifications, families, sources, MIME types, hashes, fallbacks, dimensions, duration, and alt text.
- Exposed all requested lazy relation fields and unified `event.hasMedia`.
- Extended generic `explode` for one-level plain-object properties.
- Updated presentation behavior and README vocabulary.
- Added a public functional attachment scenario.

Validation:

- Syntax checks passed.
- Full functional suite passed: 29/29.
- Attachment scenario passed after final changes.
- `git diff --check` passed.
- Browser smoke was attempted but Chromium could not launch due the sandbox denying macOS Mach port registration.

Permanent tests added:

- One public-boundary functional scenario protecting normalized merging, conflicts, inference provenance, deterministic bounds, generic object explosion, schema visibility, evidence retention, and turnover behavior. Temporary validation would not adequately protect this stable compositional relation contract.

Unresolved uncertainties:

- Browser smoke remains unverified because of the environment-level Chromium launch restriction.