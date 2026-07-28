Implemented task 069.

Deliverables changed:

- Added dependency-light `event-content.js` with the exact sparse kind mapping.
- Added lazy `event.role`, `event.format`, and `event.conversationRole` relation fields.
- Reused `deriveEventRelationships()` for kind-1 reply/quote interpretation.
- Documented the new public relation behavior.
- Added the new module to syntax checking.

Validation performed:

- Syntax checks passed.
- Full functional suite passed: 28/28.
- Focused scenario passed after final changes.
- `git diff --check` passed.
- Browser Worker bundled successfully, but Chromium launch was blocked by the managed macOS sandbox (`MachPortRendezvousServer: Permission denied`).

Permanent tests added:

- One public session/relation scenario protecting known and unknown kinds, reply/quote and malformed/ambiguous threading, outer repost semantics, distinct conversation roles, contextual schema visibility, and lazy post-eviction resolution.
- Permanent coverage is justified because these are stable public relation semantics shared across direct, plan, session, JSONL, and Worker consumers.

Unresolved uncertainties:

- Browser runtime assertions could not execute because of the environment-level Chromium launch restriction.