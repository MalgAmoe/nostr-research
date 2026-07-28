Implemented explicit attributed NIP-45 `relay-count`.

Deliverables changed:

- Added the runtime-neutral WebSocket count implementation.
- Registered direct, plan, session, JSONL, and browser Worker execution paths.
- Added session defaults, handles, lifecycle, schema, and four bounded presentation modes.
- Preserved exact/approximate counts, HLL, NOTICE, AUTH, CLOSED, malformed, timeout, cancellation, and transport outcomes per relay.
- Updated package documentation, `NEXT-STEPS.md`, capability map, and `CONTEXT.md`.
- Extended browser smoke coverage.

Validation:

- Syntax checks passed.
- Complete functional suite passed: 27 tests.
- Targeted relay-count, relay-information, and schema tests passed.
- `git diff --check` passed.
- Browser bundle completed, but Chromium launch was blocked by the managed macOS sandbox (`MachPortRendezvousServer: Permission denied`).

Permanent tests added:

- Public-boundary relay-count functional coverage protecting normalization, plan/session executor reuse, configured defaults, attribution, bounded diagnostics, cancellation, memory non-mutation, handle lifecycle, presentation, schema isolation, and prohibition on summed relay counts.
- Permanent coverage is justified because these are stable cross-adapter product contracts.

Unresolved uncertainties:

- Browser runtime assertions could not execute due to the environment’s Chromium sandbox restriction.
- No live public-relay probe was run because network access is restricted.