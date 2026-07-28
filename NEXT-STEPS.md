# Project next steps

Status: current direction after the completed protocol, runtime, relay, and
event-content milestones on 2026-07-28.

## Current position

The project has a usable core:

```text
canonical Nostr evidence
→ bounded process-local memory
→ stable subject collections
→ composable research relations
→ one normalized executor
→ persistent declarative session
→ JSONL and browser Worker adapters
```

Completed work includes kind-aware relationships; event, account, and address
navigation; Nostr reference decoding; the runtime-neutral core and Worker
adapter; relay diagnostics, NIP-11 inspection, and NIP-45 counts; event role,
format, media, attachment, and warning facts; and sustained sequential research
without arbitrary JavaScript. Relation stages now report truthful
operation-specific cardinality and proven truncation, summaries share explicit
count units across handle kinds, and relay coverage distinguishes unstarted,
pre-open, subscribed-zero-packet, and contributing attempts without guessing a
cause.

The practical CLI is now documented in [CLI.md](./CLI.md), separately from the
detailed library reference.

## Product direction

Nostrarium's caller-side vessel is a coherent research posture for moving
through an effectively unbounded, noisy Nostr field. Its durable definition
and ownership model live in [CONTEXT.md](./CONTEXT.md); its unresolved details
are to be discovered through use rather than specified in advance.

The system does not ingest the whole network. It acquires bounded windows,
exposes what is present, lets the researcher navigate or acquire in a chosen
direction, and makes explicit what should be retained before renewable
evidence is lost.

The researcher supplies judgment. The engine supplies canonical and attributed
evidence, bounded working sets, mechanical transformations, protocol
navigation, explicit external operations, honest partiality, and deliberate
archive and notebook actions.

It must not silently select a direction, import popularity as relevance, or
classify accounts as good, human, credible, or interesting.

## What to do next

There is no agreed implementation milestone. Start with another sustained
vessel-style trial from a cold random field using only the documented CLI.

Observe:

- how expensive it is to find the first useful anchor;
- whether field structure and contextual schema remain understandable;
- how evidence windows are advanced or abandoned;
- when preservation or notebook judgments become useful;
- whether media and event-format facts materially change navigation;
- which operation, if any, repeatedly forces awkward reconstruction.

Only repeated, concrete friction should become an engine task.

In parallel, it is reasonable to sketch the human interaction model without
building a UI: what a researcher sees when entering a field, inspecting it,
choosing a direction, retaining evidence, and allowing old observations to
fall away.

## Parked capabilities and triggers

- Multi-filter `REQ`: reconsider when repeated acquisitions need the same
  combined request and round trips become material.
- NIP-50 remote search: reconsider only if directed anchoring becomes more
  important than the random-field constraint and a reliable search relay is
  in the test set.
- NIP-42 authentication: reconsider only when a relay needed for research
  requires authenticated reads.
- Retry or relay-routing policy: reconsider when explicit diagnostics and
  sequential retry information prove insufficient.
- Buffer capacity above 1,000: measure selection, relation resolution,
  inspection, cloning, and browser memory before changing it.
- Persistence: reconsider only when process-local loss blocks real use.
- Rust or another lower-level implementation: reconsider only when measured
  constraints justify it.

## Deliberately declined

Typed NIP-51 list navigation is not a product direction. Published account
lists import the network's incumbent, overlapping topology and can pull
research toward its loudest echo chamber. Raw list events remain ordinary
evidence and may be mechanically inspected, but the engine will not silently
turn their curation into navigation weight.

Also avoid hidden next-operation recommendations, background acquisition,
trust or popularity scores, speculative task-specific commands, a universal
event-kind framework, and persistence merely because production systems
conventionally have one.

## Reference material

- [CLI.md](./CLI.md): operating guide.
- [packages/nostr-research/README.md](./packages/nostr-research/README.md):
  detailed library and protocol reference.
- [CONTEXT.md](./CONTEXT.md): durable principles and terminology.
- [NOSTR-PROTOCOL-CAPABILITY-MAP.md](./NOSTR-PROTOCOL-CAPABILITY-MAP.md):
  detailed protocol coverage and future possibilities.
- [workflow/WORKFLOW.md](./workflow/WORKFLOW.md): worker/reviewer task runner.

Completed task definitions and run records remain under `workflow/`. They are
historical execution evidence, not current product documentation.
