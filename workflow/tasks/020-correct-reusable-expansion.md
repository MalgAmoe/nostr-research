---
id: 020-correct-reusable-expansion
status: done
max_attempts: 5
validation: workflow/tasks/020-correct-reusable-expansion.validate.sh
depends_on: 019-bounded-targeted-expansion
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make targeted expansion correct and reusable

## Reason

Live use and three independent reviews found two correctness risks in the
current targeted expansion:

- inbound reply acquisition sets the relay filter limit to the number of
  target event IDs, so one selected note requests at most one reply even when
  the global budget allows a larger conversation; and
- expansion claims to keep explicit event seeds resident, but re-adding an
  existing workspace record does not change its FIFO position, so a seed may
  be evicted when a small workspace is full.

Expansion is also genuine library research behavior but is implemented inside
the persistent-console adapter. Other JavaScript consumers cannot use it
without constructing a console environment.

## Objective

Expose targeted expansion through the package's exported library surface and
make its bounds truthful under conversation breadth and workspace pressure.
Keep the console as a thin consumer of that operation.

The exported API name and exact parameter packaging may follow the existing
library vocabulary, but it must accept an open memory, bounded workspace,
explicit selection, and the established expansion options without depending
on a REPL or session.

## Correct reply breadth

For inbound `reply-parent` or `reply-root` expansion:

- query only kind-1 notes carrying `#e` references to reached event IDs;
- do not equate reply breadth with the number of target IDs;
- let the remaining operation-wide event/observation budget bound the request;
- preserve the existing global timeout, traversal limit, and depth;
- deduplicate target IDs and filters; and
- report when the budget prevents further reply acquisition.

Do not introduce automatic pagination or claim an exhaustive thread.

## Seed residency

Build a deterministic functional reproduction with a workspace whose capacity
is smaller than the seed plus all acquired evidence. The final result and
report must remain truthful:

- explicit starting event subjects remain traversable throughout the
  operation;
- acquisition may evict other disposable workspace evidence according to a
  simple documented policy;
- workspace capacity is never exceeded;
- evictions remain observable; and
- durable SQLite evidence is never lost.

Choose the smallest cohesive workspace mechanism needed to preserve expansion
starts. Do not create a Buffer, Vessel, cargo manager, or general cache-policy
framework.

## Library boundary

Move expansion orchestration and validation out of `src/console.js` into a
cohesive exported library operation. The console wrapper should retain only:

- progress messages;
- ownership/cancellation of active interactive operations; and
- convenient binding on `research.expand`.

Share the relationship vocabulary or traversal option validation only where
the extraction naturally requires it. Do not broadly refactor memory and
workspace traversal algorithms in this task.

## Boundaries

- No authored-note sampling yet.
- No presentation redesign.
- No mutation of session selection.
- No default relays, retries, crawling, scoring, or automatic relevance.
- No broad JavaScript-interface redesign.
- No tests of private filter-building helpers.

## Verification

Use public functional boundaries with real SQLite and local NIP-01 WebSocket
relays to prove:

- a seed with more than ten available replies retrieves multiple replies under
  an adequate global budget;
- lowering the global budget bounds reply acquisition;
- a full tiny workspace does not lose explicit expansion starts;
- partial relay failure preserves useful results and diagnostics;
- cancellation releases sockets;
- the exported operation works without the console environment;
- the console delegates to the same operation and leaves session selection
  unchanged; and
- retained results reopen from SQLite.

Run the complete existing suite and syntax checks.

## Acceptance criteria

- Conversation expansion is not silently limited to one reply per seed.
- Expansion starts remain usable under real workspace pressure.
- Expansion is part of the exported UI-independent library.
- The console does not own duplicate expansion behavior.
- Existing bounds, reasons, provenance, coverage, and retention remain intact.
