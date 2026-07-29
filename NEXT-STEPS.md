# Project next steps

Status: current direction after naming Nostrarium and defining the caller-side
vessel on 2026-07-29.

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

Independent agent trials have confirmed that the documented algebra supports
substantial research without arbitrary JavaScript: acquiring a field,
identifying accounts, hydrating profiles, scanning and aggregating evidence,
making an external judgment, and returning selected identities to navigable
collections. Those trials also confirmed that bounds, partiality, relay
participation, and response-size limits are exposed honestly when the operator
reads the complete response.

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

The first direct vessel-discovery round is recorded in
[VOYAGE-TRIALS.md](./VOYAGE-TRIALS.md). Three sequential voyages tested broad
field orientation, media evidence, and account discovery through the persistent
CLI without arbitrary JavaScript or engine changes.

For each sustained trial:

1. Start from a bounded, relatively random field rather than a directed remote
   search.
2. Give the voyage a concrete collection intent, while treating the vessel's
   movement, senses, and judgment practices as provisional.
3. Operate sequentially: observe each response and its bounds, make a
   navigator decision, then choose the next operation.
4. Record what was habitually made visible, which routes were preferred or
   abandoned, where judgment entered, and what was deliberately collected.
5. Repeat with enough variation to distinguish one useful convention from an
   accidental property of a single question.

The first likely posture is broad random-field profile discovery because it
has already produced a coherent loop: expose field structure, navigate toward
accounts and their evidence, use summaries and coverage as habitual senses,
record explicit interest or exclusion, and collect explainable profiles with
supporting evidence. This is a starting posture to inhabit and revise, not a
formal vessel specification.

Those voyages now justify extracting the first of two caller-side layers:

- a neutral session driver that owns process lifetime, command IDs, response
  correlation, transcripts, contextual controls, visible handle lifecycle, and
  compact post-operation orientation without adding research semantics; and
- vessel conventions that arrange movement, senses, explicit judgment, and
  collection over visible engine operations.

The next work is to define and build the smallest neutral controller around the
existing session protocol, then repeat the voyages through it. It must compile
to the same visible commands, derive controls from schema, keep the navigator
responsible for every next action, and make immutable evidence, current subject
resolution, bounds, and handle lifecycle understandable.

The code-boundary review and proposed minimal interface are recorded in
[NEUTRAL-CONTROLLER-PROPOSAL.md](./NEUTRAL-CONTROLLER-PROPOSAL.md). The proposed
implementation order is a runtime-neutral controller core first, followed by a
Node JSONL transport and one repeated voyage. Browser transport and
presentation remain later decisions informed by that use.

The controller core and Node JSONL transport have now been implemented and
independently reviewed. The repeated live voyage is recorded in
[VOYAGE-TRIALS.md](./VOYAGE-TRIALS.md); it confirmed that the controller removes
mechanical session friction without selecting research actions or observation
modes. The next decision should be based on using this controller boundary,
not on adding more engine or transport behavior speculatively.

Do not build a general vessel framework or visual UI yet. The controller should
remove only the mechanical friction recorded by the trials. Vessel conventions
should be extracted only after the controller itself has been used.

Engine work resumes only for a verified correctness problem or a generic
operation repeatedly reconstructed outside the library. Difficulty caused by
noisy, malformed, incomplete, or socially concentrated Nostr data is research
reality, not automatically an engine defect.

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
- [VOYAGE-TRIALS.md](./VOYAGE-TRIALS.md): direct voyage evidence and control
  implications.
- [NEUTRAL-CONTROLLER-PROPOSAL.md](./NEUTRAL-CONTROLLER-PROPOSAL.md): inspected
  controller boundary, minimal interface, and first implementation milestone.
- [packages/nostr-research/README.md](./packages/nostr-research/README.md):
  detailed library and protocol reference.
- [CONTEXT.md](./CONTEXT.md): durable principles and terminology.
- [NOSTR-PROTOCOL-CAPABILITY-MAP.md](./NOSTR-PROTOCOL-CAPABILITY-MAP.md):
  detailed protocol coverage and future possibilities.
- [workflow/WORKFLOW.md](./workflow/WORKFLOW.md): worker/reviewer task runner.

Completed task definitions and run records remain under `workflow/`. They are
historical execution evidence, not current product documentation.
