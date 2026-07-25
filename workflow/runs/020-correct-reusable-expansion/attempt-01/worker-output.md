Implemented targeted expansion corrections.

Deliverables changed:

- Added exported `expandResearch(memory, workspace, selection, options)` library operation.
- Reduced console expansion to progress, cancellation ownership, and delegation.
- Reply filters now use the remaining global event budget instead of target count.
- Added protected-seed workspace insertion with FIFO eviction of disposable evidence.
- Added functional coverage for broad replies, constrained budgets, tiny workspaces, direct library use, and durable evidence.
- Updated README and syntax-check configuration.

Validation:

- Full task validation passed.
- 20 tests passed; 6 local-relay tests skipped because the sandbox forbids loopback listeners.
- All source syntax checks passed.
- Confirmed `expandResearch` is exported.
- `git diff --check` passed.

Unresolved uncertainty:

- Local WebSocket scenarios could not execute in this sandbox; they remain available for loopback-capable review environments.
- Pre-existing unrelated deletions under `spikes/turso-portability/` were left untouched.