---
id: 066-relay-message-and-outcome-visibility
status: done
max_attempts: 4
validation: workflow/tasks/066-relay-message-and-outcome-visibility.validate.sh
depends_on: 065-preserve-direct-field-lineage
---

# Expose relay messages and request outcomes honestly

## Confirmed code seam

All relay-backed research paths reach `acquireRelayEvents`. Its message handler
currently applies the subscription-ID guard before dispatching packet types.
That is correct for `EVENT`, `EOSE`, and `CLOSED`, but it silently discards
connection-level `NOTICE` and `AUTH` messages, whose second element is not a
subscription ID.

The current result also classifies a socket closing before EOSE as generic
`connection-failure`, conflating failure before a WebSocket opens with a peer
that accepted the connection and later closed it. `CLOSED` retains raw text but
does not expose standardized reason prefixes. EOSE ends the attempt without
retaining NIP-67 `finish` or `more` hints.

Acquisition reports flow through direct execution, plans, declarative session
handles, compact external status, `show`, schema, and the browser Worker. New
facts must survive that complete path rather than remaining private transport
logs.

## Goal

Make bounded relay messages, refusals, and completion facts observable without
adding retries, authentication, routing policy, or another acquisition
implementation.

## Required work

1. Dispatch connection-level and subscription-level relay packets according to
   their actual protocol shapes. Do not weaken subscription-ID validation for
   `EVENT`, `EOSE`, or `CLOSED`.
2. Capture bounded `NOTICE` messages per relay. Preserve their text and
   omission count; a relay cannot grow an unbounded diagnostic array.
3. Parse standardized `CLOSED` reason prefixes into a small factual category
   while retaining the exact bounded raw reason. Unknown prefixes remain
   visible as unknown rather than being guessed.
4. Distinguish at least:
   - failure before the WebSocket opens;
   - an opened peer closing before EOSE or explicit `CLOSED`;
   - explicit subscription refusal through `CLOSED`;
   - EOSE completion; and
   - operation-wide timeout, cancellation, or budgets.
   Keep existing stable outcome names where they remain truthful; do not
   rewrite all acquisition vocabulary merely for symmetry.
5. Parse the currently specified NIP-67 `finish` and `more` EOSE hints. Retain
   the attributed hint and its raw bounded value. Neither hint establishes
   global relay exhaustiveness.
6. Keep authentication evidence as three separate facts:
   - an observed relay `AUTH` challenge is neutral
     `authChallengeObserved` transport evidence;
   - `auth-required` is an observed request outcome only when the subscription
     is actually refused with that standardized reason; and
   - a future NIP-11 `advertisedAuthRequired` value is a relay claim and is not
     part of this acquisition task.
7. Do not answer an `AUTH` challenge, load or generate keys, publish an event,
   or fail a read merely because a challenge was observed.
8. Extend acquisition reports and coverage with the new bounded per-relay
   facts. Preserve existing event, observation, duplicate, corpus, and bound
   accounting.
9. Carry the facts through:
   - direct execution and named plans;
   - session external status and warnings;
   - named acquisition handles;
   - `show coverage` and `show details`;
   - global and contextual factual schema; and
   - the existing browser-compatible public core.
10. Keep presentation concise. Compact command responses should summarize
    noteworthy outcomes; full bounded diagnostics belong in explicit `show`
    modes.
11. Update package documentation, the capability map, `NEXT-STEPS.md`, and
    `CONTEXT.md` only where implementation establishes durable behavior.

## Acceptance criteria

- `NOTICE` and `AUTH` are no longer discarded by the subscription-ID guard.
- A neutral `AUTH` challenge does not change a successful read into
  `auth-required`.
- An actual standardized `auth-required:` refusal is machine-readable and
  remains distinct from any future NIP-11 advertisement.
- Pre-open failure, peer-close-after-open, explicit `CLOSED`, EOSE, and
  operation bounds are distinguishable in the public acquisition report.
- Recognized `CLOSED` prefixes and NIP-67 hints retain both structured meaning
  and bounded raw evidence.
- Every new fact is observable through a named session handle and bounded
  presentation/schema; no fact exists only in socket callbacks.
- Existing acquisition budgets, canonical validation, filter matching,
  deduplication, cancellation, and runtime-neutral behavior remain intact.
- No retry loop, connection pool, signer, NIP-11 fetch, NIP-45 count, relay
  score, or routing decision is introduced.

## Verification

- Permanent tests expected: yes, by extending an existing public-boundary
  acquisition/session scenario with deterministic standard-WebSocket
  fixtures.
- Stable public behavior protected: packet dispatch, honest outcomes,
  acquisition accounting, bounded diagnostics, schema, and presentation.
- The fixture should exercise representative `NOTICE`, `AUTH`, standardized
  `CLOSED`, NIP-67 EOSE, and peer-close cases through the public core. It must
  not import private socket helpers.
- Temporary task validation: syntax checks, the complete functional suite,
  and the existing runtime-neutral/browser validation where applicable.
- Explicitly excluded: TCP, TLS, real WebSocket servers, exact timing, live
  relay reliability, retry behavior, NIP-42 signing, and exhaustive tests for
  every possible human-readable relay message.
