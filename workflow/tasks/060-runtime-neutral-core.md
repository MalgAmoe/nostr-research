---
id: 060-runtime-neutral-core
status: ready
max_attempts: 4
validation: workflow/tasks/060-runtime-neutral-core.validate.sh
depends_on: 059-inline-nostr-reference-navigation
---

# Make the established research core runtime-neutral

## Code findings

The public core is already largely based on Web Platform primitives. Two
production dependencies currently prevent a browser-compatible import:

- `acquire.js` imports `ws` and relies on its non-standard `terminate()` method
  plus Node timer `unref()` during socket teardown.
- `presentation.js` uses `Buffer.byteLength` to enforce bounded UTF-8 JSON
  output.

`jsonl-session.js` and the executable correctly own `node:readline`,
stdin/stdout, process arguments, and signals. They are Node adapters and must
remain outside the runtime-neutral core.

Acquisition is reached through direct calls, normalized operations, plans,
sessions, hydration, continuation, and relation-backed fetch. Any runtime
capability must therefore enter at the shared execution seam rather than being
smuggled into JSON operation parameters or implemented separately in callers.

## Goal

Allow the existing public memory, operation executor, declarative session,
schema, and bounded presentation modules to run with standard browser
primitives while preserving the Node JSONL caller's observable behavior.

## Required work

1. Remove the direct `ws` import and all assumptions about `terminate()` and
   timer `unref()` from the runtime-neutral acquisition implementation.
2. Prefer the standard WebSocket interface already available in supported
   Node versions and browsers. Introduce a tiny injected constructor or factory
   only if the standard global cannot preserve the acquisition contract.
   Do not build a generalized transport framework.
3. Make timeout, cancellation, EOSE, CLOSED, connection failure, and
   operation-wide budget completion settle deterministically without waiting
   indefinitely for a peer closing handshake. Once acquisition has finished,
   later socket messages must not mutate memory or accounting.
4. If injection is necessary, keep the capability outside normalized command
   parameters, schemas, provenance, and JSON serialization. Direct execution,
   plans, sessions, hydration, continuation, and fetch must still reach the
   same acquisition implementation.
5. Replace `Buffer.byteLength` with a small runtime-neutral UTF-8 byte
   measurement while preserving the existing approximate `sizeLimit`
   behavior and bounded presentation shapes.
6. Keep JSONL parsing, Node streams, signals, process arguments, and CLI
   diagnostics in the Node adapter. Do not make the browser import depend on
   `jsonl-session.js`.
7. Remove the `ws` package dependency if no Node adapter still needs it. Do
   not add another networking dependency merely to replace it.
8. Preserve operation names, command envelopes, result handles, schema,
   acquisition coverage, warnings, and public result shapes.
9. Update `CONTEXT.md`, package documentation, and the runtime-neutral
   milestone status only where the implemented seam is now a durable fact.

## Acceptance criteria

- Importing the public core does not require Node built-ins, `ws`, or
  `Buffer`.
- Acquisition uses one implementation across direct, plan, session,
  continuation, hydration, and fetch paths.
- Research commands remain JSON-serializable and contain no runtime objects.
- Timeout and cancellation return bounded partial outcomes and cannot ingest
  events after completion.
- The JSONL executable continues to expose the same caller-visible protocol.
- No frontend, alternate operation executor, connection pool, retry policy,
  relay-ranking policy, or transport framework is introduced.

## Verification

- Permanent tests expected: normally no new test.
- Stable public behavior protected: existing acquisition accounting,
  cancellation, operation execution, JSONL behavior, and bounded presentation.
- Existing public-boundary tests may be adjusted if implementation-neutral
  assertions are necessary, but must not test TCP, TLS, the WebSocket library,
  private socket helpers, process scheduling, or exact timing.
- Temporary task validation: syntax checks, the complete functional suite, a
  public-core import with `Buffer` unavailable, and inspection of the public
  core dependency graph for Node-only imports.
- Explicitly excluded: live relay reliability tests, browser UI, bundler
  selection, package splitting, persistence, TypeScript conversion, and a
  generalized networking abstraction.
