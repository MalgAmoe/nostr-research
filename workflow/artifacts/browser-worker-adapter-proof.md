# Browser Worker adapter proof

## Scope

Task 062 adds the package subpath
`@nostr-research/memory/browser-worker`. The module is the Worker entry itself:
it creates one bounded process-local memory and one existing declarative
research session after a caller-correlated initialization message. It does not
contain a second executor or translate research commands and responses.

The task-level harness loads that actual package entry after installing a
minimal Worker-global message shim. A deterministic WebSocket stand-in supplies
canonical fixture events through the same public acquisition path used by the
library. Every input and posted response is JSON-round-tripped.

## Proven

- A command before initialization returns a correlated
  `WORKER_NOT_INITIALIZED` envelope.
- Invalid and duplicate initialization return bounded correlated Worker
  lifecycle errors; valid initialization chooses memory/archive/notebook
  capacities and initial session configuration.
- Messages reach the owned declarative session in arrival order. A status
  command observes the preceding bounded acquisition.
- The acquisition observation limit is visible in the unchanged session
  response and the one-event memory capacity remains bounded.
- A malformed ordinary command returns the existing session
  `INVALID_COMMAND` envelope.
- A close command cancels an active acquisition through the existing session
  cancellation seam, then returns the existing `close-session` result.
- The Worker remains alive after research-session closure, and a later command
  receives the existing correlated `SESSION_CLOSED` response.
- The Worker entry imports the runtime-neutral public core and no Node
  built-in, JSONL adapter, workflow module, or alternate research engine.
- Package syntax checks and the complete existing functional suite continue to
  cover the public core and JSONL adapter.

## Not proven

This is a deterministic Node-based Worker-global shim, not an actual browser
run. Actual Safari/browser execution remains unverified until a browser
automation setup is chosen. The proof makes no claim about Safari setup,
browser module resolution or bundlers, screenshots, DOM/UI behavior, service
workers, browser storage, live relay reliability, or frontend architecture.
