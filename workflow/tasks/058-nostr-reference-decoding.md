---
id: 058-nostr-reference-decoding
status: ready
max_attempts: 4
validation: workflow/tasks/058-nostr-reference-decoding.validate.sh
depends_on: 057-addressable-event-subjects
---

# Decode shareable Nostr references into stable subjects

## Goal

Let callers turn human-facing NIP-19 and NIP-21 references into the same
event, account, and address subjects already used by the research engine,
without treating transport hints as identity or silently contacting relays.

## Required work

1. Add one small authoritative reference-decoding boundary using the existing
   `nostr-tools` dependency rather than implementing bech32/TLV mechanics.
2. Accept the research-relevant NIP-19 entities:
   - `npub` and `nprofile` -> account subject;
   - `note` and `nevent` -> immutable event subject;
   - `naddr` -> address subject from task 057.
3. Accept the same entities when wrapped in a NIP-21 `nostr:` URI.
4. Reject private `nsec` material and unsupported or malformed entities with a
   bounded, semantic public error. Apply NIP-19's 5000-character input bound.
5. Return a structured decoded reference containing:
   - the stable subject;
   - the original reference form;
   - optional author, kind, and relay hints actually present in the encoding.
   Unknown TLV fields are ignored as required by NIP-19.
6. Keep hints attributed to the decoded reference. They must not alter subject
   identity, mutate session relay defaults, trigger acquisition, or be
   presented as verified facts.
7. Integrate decoded references into the smallest existing caller-input seams
   where a human or agent supplies a subject for resolution or inspection.
   Do not create alternate operations or duplicate collection semantics.
8. Expose the accepted reference forms and hint semantics factually through
   the existing schema and documentation.

## Acceptance criteria

- Equivalent hex, bare NIP-19, and `nostr:` forms resolve to the same stable
  subject.
- Relay hints do not participate in identity and are never followed
  automatically.
- `naddr` uses the canonical address rules from task 057.
- `nevent` author/kind hints remain visible but do not override canonical
  event evidence.
- Invalid, oversized, private, and unsupported inputs fail predictably.
- The implementation is a normalization boundary, not a new scripting,
  routing, or acquisition framework.

## Verification

- Permanent tests expected: yes.
- Stable public behavior protected: supported NIP-19/NIP-21 decoding,
  rejection boundaries, stable subject equivalence, and separation of hints
  from identity and session configuration.
- A single public-boundary functional scenario should cover representative
  entities and caller integration; do not test third-party bech32 internals.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: QR/rendering behavior, `nsec`, live relay access,
  automatic routing, browser protocol handlers, and UI.
