---
id: 025-single-corpus-runtime
status: done
max_attempts: 5
validation: workflow/tasks/025-single-corpus-runtime.validate.sh
depends_on: 024-in-memory-research-memory
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Move the complete research runtime onto one corpus

## Decision

The in-memory research memory from task 024 is now the sole active corpus for
the running application. The durable-memory plus temporary-workspace split is
being removed. SQLite may remain in the repository only as the temporary
comparison implementation until the cleanup task that follows.

## Objective

Move every active research workflow onto one capacity-bounded in-memory owner
without losing same-process capabilities.

Update:

- relay acquisition;
- targeted expansion;
- bounded reply-context resolution;
- sessions;
- presentation and facets;
- the persistent JavaScript console; and
- their public functional scenarios.

## Runtime semantics

- Relay acquisition ingests directly into the active corpus.
- There is no acquire-into-memory then hydrate-workspace step.
- Expansion and reply-context resolution receive one corpus rather than a
  durable memory plus a second workspace.
- Explicit expansion starts remain protected for the duration of bounded
  additions.
- Acquisition and expansion make additions, refreshes, evictions, capacity
  pressure, limits, cancellation, and partial relay outcomes observable.
- Events and accounts search the same resident corpus.
- Sessions, inspection, projection, facets, runs, retained sets, and set
  operations use that same corpus.
- `load(query)` becomes a local selection/use operation over the resident
  corpus. It may replace session selection, but it does not reconstruct a
  second corpus or silently contact relays.
- A retained group remains usable during the process even when a member's
  canonical evidence has been evicted; inspection must distinguish a retained
  subject reference from resident evidence.
- "Stored" means resident in the current corpus, not durably accumulated
  behind it.

The console remains Node-based in this milestone. Remove the `--db` argument
and keep explicit `--capacity`. Preserve `research.memory` as the advanced
access route. Remove `research.workspace` rather than maintaining a permanent
alias.

## Boundaries

Do not remove other Node-specific modules yet. Keep `node:fs`, `node:crypto`,
the `ws` package, Node REPL, and the Node test runner where currently needed.

Do not build browser entry points, persistence, storage adapters, import/export,
workers, Rust/Wasm, ranking, automatic crawling, or compatibility layers for
the old console command.

The current package is experimental: make one clear breaking change rather
than supporting parallel runtime concepts.

## Verification

Verify one complete public research process:

1. create a bounded memory;
2. ingest or acquire canonical evidence;
3. search events and accounts;
4. select and orient with facets;
5. navigate current profiles, follows, and relationships;
6. traverse and perform targeted expansion;
7. resolve bounded reply contexts;
8. inspect evidence and provenance;
9. retain and combine named groups;
10. continue from a retained group; and
11. observe deterministic capacity pressure and eviction.

Network functional tests must continue to cover explicit limits,
cancellation, timeout, partial failures, deduplication, and provenance.
Tests should exercise public boundaries and must not inspect internal maps.

## Acceptance criteria

- Production runtime paths use one in-memory corpus.
- No active operation requires both memory and workspace objects.
- Acquisition does not write and reread the same event through SQLite.
- Search, navigation, expansion, reply contexts, sessions, presentation,
  coverage, runs, and retained groups remain usable in one process.
- Console startup requires capacity but no database path.
- Corpus pressure and evictions are visible.
- The complete functional suite and syntax checks pass.

