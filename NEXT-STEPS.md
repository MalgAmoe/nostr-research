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

The neutral controller and Node JSONL transport are implemented. Three
controller-operated voyages, recorded in
[VOYAGE-TRIALS.md](./VOYAGE-TRIALS.md), confirmed that this boundary removes
process, correlation, transcript, and handle-orientation friction without
selecting research actions. They did not expose another controller defect or a
missing engine primitive.

The remaining friction sits above the controller: raw structured commands,
unarranged contextual controls, and choosing an evidence projection at each
research moment.

The first navigator-facing arrangement now exists as two pure projections over
the controller: contextual schema becomes complete control groups, and
ordinary `show` responses become orientation, evidence, paging, and context
panels. A live account-discovery voyage confirmed that this improves visibility
without constructing commands, choosing routes, or hiding operations. The
trial is recorded in [VOYAGE-TRIALS.md](./VOYAGE-TRIALS.md).

The next experiments are defined in
[NAVIGATOR-VOYAGE-SUITE.md](./NAVIGATOR-VOYAGE-SUITE.md). Six contrasting
voyages test thread movement, media evidence, weak signals, disconfirming
judgment, account depth, and deliberate collection through the unchanged
arrangement. Do not add convenience commands merely because raw JSON remains
verbose; normally require repeated friction across voyages.

Voyage 1, thread descent, is complete. It found no correctness defect and
recorded one command-construction error after the navigator skipped a focused
contract. The next experiment is Voyage 2, media trail, with the arrangement
unchanged.

The experiment should compare the voyages to identify:

- stable movement and observation habits worth making easy;
- choices that vary with the collection intent and must stay exposed;
- the moments where navigator judgment enters;
- the evidence needed to explain collected subjects; and
- the lifecycle controls needed to keep a voyage bounded.

Do not build a general vessel framework or visual UI yet. Build the smallest
arrangement that can be used in another voyage, then revise it from evidence.
Vessel conventions remain caller-side and must compile to visible controller
commands.

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
- [NAVIGATOR-VOYAGE-SUITE.md](./NAVIGATOR-VOYAGE-SUITE.md): active contrasting
  voyage protocol and progressive results.
- [packages/nostrarium-controller/README.md](./packages/nostrarium-controller/README.md):
  neutral controller and Node transport.
- [packages/nostr-research/README.md](./packages/nostr-research/README.md):
  detailed library and protocol reference.
- [CONTEXT.md](./CONTEXT.md): durable principles and terminology.
- [NOSTR-PROTOCOL-CAPABILITY-MAP.md](./NOSTR-PROTOCOL-CAPABILITY-MAP.md):
  detailed protocol coverage and future possibilities.
- [workflow/WORKFLOW.md](./workflow/WORKFLOW.md): worker/reviewer task runner.

Completed task definitions and run records remain under `workflow/`. They are
historical execution evidence, not current product documentation.
