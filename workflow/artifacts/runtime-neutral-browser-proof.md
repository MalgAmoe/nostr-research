# Runtime-neutral browser proof

## What was proven

The task-level harness `workflow/tasks/061-browser-compatible-session-proof.mjs`
loads the public `@nostr-research/memory` package entry after making `Buffer`
unavailable. It does not import the JSONL adapter, executable, private source
modules, or Node built-ins.

With a deterministic implementation of the standard `WebSocket` surface
installed on `globalThis`, the harness operates the real public memory,
acquisition executor, declarative session, navigation, and presentation code.
One structured-command sequence:

1. configures an explicit relay plus timeout, observation, distinct-event, and
   concurrency bounds;
2. acquires two valid signed Nostr events and observes complete EOSE coverage,
   acquisition counts, relay outcome, and provenance;
3. selects that bounded acquisition attempt into an event handle;
4. navigates from the events to their author;
5. shows a bounded author result and inspects an acquired event with resolved
   evidence and provenance;
6. observes memory and handle counts through session status; and
7. closes the session.

A second short session starts an acquisition against a deterministic source
that deliberately remains open. Closing the session cancels the active
operation through the public session/acquisition seam. The acquisition still
returns its ordinary bounded response with `cancelled` among the reached
bounds and partial completeness before the close response completes. This
verifies cancellation semantics without asserting elapsed time or
transport-library behavior.

The harness structured-clones and JSON-round-trips command objects, normalized
operations, schemas, and response envelopes. It also checks that serialized
schemas, normalized operations, provenance-bearing responses, errors/reports,
and close responses contain no `signal`, WebSocket, or Buffer capability.
Runtime capabilities therefore remain an ambient runtime seam rather than
research configuration or serialized state.

After the main session closes, one further status command verifies that errors
remain ordinary structured response envelopes with the public
`SESSION_CLOSED` code.

No package export was added: the existing public package entry already exposes
the legitimate consumer surface needed for this sequence. No product code,
browser-only operation, alternate command language, UI, persistence, network
framework, or permanent browser test was introduced.

## Environmental assumptions

A real browser or Worker must provide the Web Platform facilities used by the
public core: `WebSocket`, `crypto.randomUUID`, Web Crypto, `TextEncoder`,
`structuredClone`, timers, `AbortController`/`AbortSignal`, `URL`, and standard
ECMAScript modules. The target relay must permit the browser origin and the
environment must permit outbound secure WebSocket connections. This proof is
deterministic and intentionally does not assess live-relay availability,
TCP/TLS behavior, bundlers, service workers, browser storage, or DOM APIs.

The package currently declares a Node engine for its distributed workspace,
even though the public core exercised here uses Web Platform primitives. This
validation proves runtime behavior of the public entry directly; it does not
claim that every package manager or bundler will ignore or reinterpret that
distribution metadata.

## Worker readiness

A browser Worker can consume the declarative session next without reproducing
engine behavior. It needs only an adapter that passes ordinary structured
commands and responses across the Worker boundary and supplies the browser's
standard globals. The memory model, acquisition rules, normalized operations,
session revision/handle behavior, navigation, completeness reporting,
provenance, presentation, cancellation, and errors remain owned by the same
public core used by the JSONL consumer.
