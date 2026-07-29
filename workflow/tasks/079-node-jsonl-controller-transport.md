---
id: 079-node-jsonl-controller-transport
status: ready
max_attempts: 4
validation: workflow/tasks/079-node-jsonl-controller-transport.validate.sh
depends_on: 078-runtime-neutral-navigator-controller
protected_paths: packages/nostr-research/src packages/nostr-research/test
---

# Add the Node JSONL transport for the navigator controller

## Context

Task 078 creates a runtime-neutral controller over an injected request
function. Nostrarium already has a persistent JSONL executable that owns one
real `DeclarativeResearchSession`. The Node transport should connect these two
existing boundaries without interpreting research commands or duplicating
session behavior.

## Goal

Let a Node caller start the existing JSONL executable once and drive it
interactively through the same controller core.

## Work

1. Add a Node-specific export from `packages/nostrarium-controller` for a thin
   persistent JSONL transport.
2. The transport must:
   - launch the existing executable directly, without `npm run` or a shell;
   - accept explicit working-directory, capacity, archive-capacity,
     notebook-capacity, and response-timeout options;
   - retain one child process across requests;
   - write one JSON object plus newline per request;
   - parse stdout incrementally as strict one-response-per-line JSONL;
   - correlate responses by the request's command ID;
   - keep stdout protocol data separate from bounded stderr diagnostics;
   - expose `request`, `status`, and idempotent `close` capabilities suitable
     for injection into the controller.
3. Commands may be pending only according to the controller's sequential
   dispatch. Do not add a second scheduling layer or research queue.
4. Malformed stdout, mismatched command IDs, broken stdin, timeout, and process
   exit before a response must settle the pending request as a clear bounded
   transport failure. Nothing may wait forever.
5. Preserve bounded raw diagnostic facts needed to understand transport
   failures: malformed line excerpt, stderr excerpt and omission count, exit
   code/signal, and lifecycle state. Diagnostics are not engine responses and
   must not be inserted into the JSONL protocol.
6. Graceful controller closure must send the ordinary session `close` command
   first, then close the transport. Forced process termination is a fallback
   for transport failure, not the normal lifecycle.
7. Update the controller package documentation with the Node construction
   example. Keep the runtime-neutral root export free of Node imports.
8. Add no dependency on shell pipelines, sleeps, FIFOs, or temporary response
   files.

## Acceptance criteria

- One persistent child process accepts multiple sequential controller commands
  and retains session handles between them.
- The executable is invoked directly and stdout remains strict JSONL.
- Normal responses, semantic `ok: false` responses, and transport failures stay
  distinct.
- Malformed output and premature process exit cannot hang a request.
- Stderr and raw diagnostics are bounded and separate from research responses.
- Closing the controller closes the session and child process cleanly.
- Importing the runtime-neutral controller root remains browser-compatible and
  does not load Node built-ins.
- No research-engine source or test changes are needed.

## Non-goals

- Browser Worker transport.
- General-purpose process manager or PTY abstraction.
- Multiple concurrent subprocesses, automatic restart, retries, or process
  pooling.
- Shell command execution supplied by untrusted users.
- Parsing npm output or tolerating non-JSON stdout as successful protocol data.
- Live-relay assertions in the permanent suite.
- UI, vessel behavior, recipes, or automatic sensing.

## Verification

- Permanent tests expected: yes, one concise public-boundary persistent-process
  workflow and one malformed-output/exit failure scenario.
- Stable public behavior protected: process persistence, JSONL correlation,
  semantic-versus-transport failure, bounded diagnostics, and graceful close.
- Temporary task validation or field evidence: after reviewed implementation,
  the primary agent will run a real relay-backed voyage through the controller.
- Explicitly excluded test levels or mechanisms: WebSocket tests, permanent
  live-relay tests, private line-parser unit tests, PTY tests, subprocess stress
  tests, and exhaustive OS portability.

