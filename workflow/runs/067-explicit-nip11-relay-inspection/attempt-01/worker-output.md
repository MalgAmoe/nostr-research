Implemented explicit bounded NIP-11 relay inspection.

Deliverables changed:

- Added the shared `relay-info` operation and runtime-neutral fetch implementation.
- Added attributed per-relay outcomes, bounded document retention, normalized advertised NIPs/limitations, and `advertisedAuthRequired`.
- Integrated direct execution, plans, sessions, handles, JSONL/browser execution path, schema, and four presentation modes.
- Kept reports separate from acquisition coverage, memory, archive, and notebook state.
- Updated README, `NEXT-STEPS.md`, capability map, `CONTEXT.md`, and package checks.

Validation:

- Syntax checks passed.
- Complete functional suite passed: 25/25.
- Targeted relay-information scenario passed.
- `git diff --check` passed.
- Browser smoke reached Chromium launch but was blocked by the managed macOS sandbox (`MachPortRendezvousServer: Permission denied`), not a product assertion failure.

Permanent tests added:

- One public-boundary functional scenario protecting normalization, direct/plan/session executor sharing, configured defaults, attributed failure outcomes, bounded retention, handle listing/show/schema/release, missing optional fields, and advertised authentication behavior. Temporary validation was insufficient because these are stable cross-layer public contracts.

Unresolved uncertainties:

- Browser smoke requires rerunning in an environment permitted to launch Playwright Chromium.