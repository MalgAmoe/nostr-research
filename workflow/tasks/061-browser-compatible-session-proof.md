---
id: 061-browser-compatible-session-proof
status: ready
max_attempts: 3
validation: workflow/tasks/061-browser-compatible-session-proof.validate.sh
depends_on: 060-runtime-neutral-core
---

# Prove the declarative session under browser-like runtime constraints

## Goal

Demonstrate that the existing public core is a real non-Node application
interface by operating one declarative research session with browser-like
globals and a deterministic standard-WebSocket adapter, without creating a
second command language or permanent browser test suite.

## Required work

1. Create a task-level browser-like validation harness under
   `workflow/tasks/`. It is verification machinery, not a product consumer.
2. Run the public package entry with `Buffer` unavailable and without
   importing the JSONL adapter or executable.
3. Provide a deterministic standard-WebSocket-compatible source at the runtime
   seam established by task 060. The harness may synthesize valid signed Nostr
   events, but it must exercise the real public memory, acquisition, executor,
   session, and presentation modules.
4. Through structured session commands:
   - configure explicit relays and bounded acquisition defaults;
   - acquire canonical events;
   - select the bounded acquisition result;
   - perform at least one existing navigation or relation operation;
   - show a bounded result;
   - inspect or explain a subject;
   - observe acquisition completeness and memory state; and
   - close the session.
5. Verify that command objects and response envelopes remain ordinary
   structured data. Runtime capabilities must not appear in schemas,
   normalized operations, provenance, or serialized responses.
6. Verify timeout or cancellation through the public acquisition/session seam
   without testing TCP, TLS, WebSocket-library internals, or exact timing.
7. Add a package export path only if the validation proves the current public
   export prevents a legitimate consumer. Do not split the package or publish
   a browser-specific implementation.
8. Record `workflow/artifacts/runtime-neutral-browser-proof.md`, describing
   what was proven, remaining environmental assumptions, and whether a browser
   Worker can consume the session next without reproducing engine behavior.

## Acceptance criteria

- One browser-like consumer runs a meaningful declarative research sequence
  using the same operations and result shapes as JSONL.
- The harness uses the public interface and contains no copied research,
  acquisition, validation, or presentation logic.
- Acquisition completion, bounds, provenance, inspection, and errors remain
  visible.
- No product UI, alternate session, browser-only operation, persistence,
  networking framework, or permanent browser test suite is added.
- Any product-code change beyond task 060 is supported by a concrete failure
  of the validation harness rather than architectural preference.

## Verification

- Permanent tests expected: no.
- Stable public behavior protected: none beyond the existing functional suite;
  this task proves portability through task-level validation.
- Temporary task validation: syntax checks, the complete functional suite,
  and the browser-like harness.
- Explicitly excluded: screenshots, DOM/UI behavior, live-relay availability,
  TCP/TLS mechanics, bundler benchmarking, service workers, browser storage,
  and frontend architecture.
