CHANGES_REQUIRED

1. `packages/nostr-research/src/session.js:78-87` clears focus when excluding the focused subject. This violates the acceptance criterion that selection and focus are independently replaceable. Exclusion should change selection/exclusions without implicitly changing focus.

2. `packages/nostr-research/src/planning.js:36-40` cannot directly consume the result of `fetchRelayInformation()` from lines 85-89: the fetch helper returns NIP-11 data under `advertised`, while `relayQueryLimit()` looks for top-level `limitation`. Make these public planning primitives composable, and add a public-level test covering fetch-result-to-limit handling.