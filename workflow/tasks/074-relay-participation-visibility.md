---
id: 074-relay-participation-visibility
status: ready
max_attempts: 4
validation: workflow/tasks/074-relay-participation-visibility.validate.sh
depends_on: 073-uniform-handle-summaries
---

# Preserve relay participation facts during bounded acquisition

## Context

One live acquisition returned:

```text
contacted: true
outcome: distinct-event-budget
receivedPackets: 0
diagnostic: null
```

`contacted` is currently set before WebSocket construction. The acquisition
path tracks whether the socket opened and sends the subscription request, but
does not retain those facts in the per-relay result. When another relay
exhausts a shared budget, active attempts inherit the global stopping reason.
Afterward the report cannot distinguish a connection attempt that never opened
from an opened, subscribed attempt that produced no packets before the stop.

## Goal

Per-relay coverage should retain the transport participation facts the engine
actually observed, without guessing why a subscribed relay contributed
nothing.

## Work

1. Preserve explicit per-attempt facts for:
   - whether an attempt was started;
   - whether the WebSocket opened;
   - whether the Nostr subscription request was sent;
   - packets received and observations accepted;
   - the final per-attempt outcome.
2. Keep the existing global completion reason. A shared budget may legitimately
   stop several active attempts.
3. Make the states distinguishable:
   - no attempt started;
   - attempted but never opened before stopping;
   - opened and subscription sent but no packet arrived before stopping;
   - packets arrived but no observation was accepted;
   - observations contributed.
4. Do not infer whether a zero-packet subscribed relay was slow, silent, or
   merely late. The report should state observed lifecycle facts only.
5. Surface the new facts through:
   - normalized acquisition and hydration reports;
   - continuation reports that reuse acquisition;
   - `show coverage` and relevant details;
   - contextual and global factual schema;
   - concise external completeness only where useful.
6. Preserve runtime neutrality and the single acquisition implementation used
   by Node and browser consumers.
7. Update durable documentation describing relay attempt outcomes.

## Acceptance criteria

- A relay never assigned to a worker remains distinguishable from an attempt
  that began.
- An attempted connection stopped before `open` is distinguishable from an
  opened subscription.
- An opened subscription stopped by another relay exhausting the global budget
  can report zero packets without becoming an unclassifiable state.
- Peer failure, explicit refusal, EOSE, timeout, cancellation, NOTICE, AUTH,
  and NIP-67 behavior remain unchanged.
- The system does not claim a cause for zero packets that it did not observe.
- Acquisition, hydration, continuation, plans, JSONL, and browser Worker still
  share the same engine facts.

## Non-goals

- Connection timing, latency ranking, relay scoring, or quality inference.
- Retry, fallback, connection pooling, NIP-42 response, or relay scheduling.
- Per-relay event totals beyond existing bounded accounting.
- Changing global acquisition budgets.

## Verification

- Permanent tests expected: yes, by extending the existing public acquisition
  functional fixture for unstarted, pre-open, opened-zero-packet, contributed,
  peer-close, and EOSE outcomes.
- Stable public behavior protected: truthful lifecycle facts through direct
  acquisition and session coverage, including global-budget cancellation.
- Temporary task validation or field evidence: deterministic fake-WebSocket
  race; no public relay is required.
- Explicitly excluded test levels or mechanisms: TCP/WebSocket server tests,
  timing benchmarks, live relays, browser UI tests, and transport-helper unit
  tests.
