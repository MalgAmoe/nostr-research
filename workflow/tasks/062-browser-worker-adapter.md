---
id: 062-browser-worker-adapter
status: ready
max_attempts: 4
validation: workflow/tasks/062-browser-worker-adapter.validate.sh
depends_on: 061-browser-compatible-session-proof
---

# Add the minimal browser Worker adapter

## Current evidence

Task 061 proved that the public core runs with browser-like globals and that a
browser Worker can own the existing declarative session without reproducing
engine behavior. This environment currently has Safari but no configured
command-line headless browser. This task must therefore implement the real
Worker entry and prove its message lifecycle deterministically without
claiming an actual-browser result.

## Goal

Expose one browser Worker entry that owns a single process-local memory and
declarative session, accepts structured messages, and returns the existing
session response envelopes unchanged after initialization.

## Required work

1. Add one browser Worker entry inside the package. It may import only the
   runtime-neutral public core and Web Platform globals; it must not import the
   JSONL adapter, Node built-ins, or workflow code.
2. Define one small initialization message using the same caller-owned
   `commandId` correlation style as session commands. Initialization may choose
   memory, archive, and notebook capacities plus initial session
   configuration.
3. Return initialization success and failure in a stable structured response
   envelope. Make the distinction between Worker initialization and ordinary
   declarative session commands explicit in documentation.
4. After initialization, forward ordinary command objects to the one owned
   declarative session and post its response object without changing operation
   names, command semantics, result shapes, warnings, or error codes.
5. Process messages sequentially. An ordinary command received before
   initialization, duplicate initialization, malformed message, or command
   received after closure must return a bounded structured error rather than
   throwing out of the Worker.
6. Preserve session cancellation and closure semantics. Do not terminate the
   Worker implicitly when the research session closes; lifecycle ownership
   remains with the embedding application.
7. Add only the package export needed to construct the Worker. Do not export
   internal message helpers merely for testing.
8. Document the Worker construction and message protocol concisely alongside
   the JSONL adapter. Do not add a visual interface, framework, persistence,
   storage, or browser-specific research operation.
9. Create a task-level validation harness under `workflow/tasks/` that loads
   the actual Worker entry through a minimal Worker-global shim, exercises
   initialization, sequential commands, bounded observation, errors, and
   closure, and JSON-round-trips every message. The shim is temporary
   validation and must not enter product code.
10. Record what was and was not proven in
    `workflow/artifacts/browser-worker-adapter-proof.md`. In particular, state
    plainly that actual Safari/browser execution remains unverified until a
    browser automation setup is chosen.

## Acceptance criteria

- The package exposes one browser Worker entry and no second research engine.
- One Worker owns exactly one memory and declarative session.
- After initialization, commands and responses are the existing session
  objects without translation or compatibility shapes.
- Adapter lifecycle failures are structured and correlated.
- Runtime capabilities never enter research commands, schema, provenance, or
  serialized session state.
- The JSONL executable and all established public-core behavior remain
  unchanged.
- The task does not claim actual-browser validation from a Node-based shim.

## Verification

- Permanent tests expected: no.
- Stable public behavior protected: the existing core and JSONL behavior remain
  covered by the existing functional suite.
- Temporary task validation: syntax checks, the complete functional suite,
  import-graph checks for the Worker entry, and the task-level Worker shim.
- Explicitly excluded: Safari setup, screenshots, DOM/UI behavior, live relay
  reliability, service workers, browser storage, bundler choice, and frontend
  architecture.
