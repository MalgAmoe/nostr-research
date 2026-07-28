---
id: 057-addressable-event-subjects
status: ready
max_attempts: 4
validation: workflow/tasks/057-addressable-event-subjects.validate.sh
depends_on:
---

# Add addressable-event subjects and local navigation

## Goal

Make NIP-01 `a` coordinates stable, truthful research subjects instead of
leaving them as generic tag strings. An address identifies replaceable or
addressable event state; it must never masquerade as an immutable event ID.

## Required work

1. Add one canonical `address` subject form for
   `<kind>:<32-byte-lowercase-pubkey>:<d>`.
   - Normal replaceable kinds `0`, `3`, and `10000`–`19999` require the
     trailing colon and an empty `d`.
   - Addressable kinds `30000`–`39999` retain the complete `d` value,
     including any colons after the first two separators.
   - Other kinds and malformed coordinates are rejected as address subjects.
2. Integrate address subjects with the existing stable-subject machinery:
   collections, lookup, inspection, evidence resolution, notebook membership,
   preservation references, presentation, and relation subject extraction.
   Do not create a parallel address API.
3. Resolve an address locally to the current resident or archived replaceable
   event using the existing timestamp and lowest-ID tie-breaking rules.
   Historical event IDs remain independently inspectable evidence.
4. Derive typed address relationships from canonical tags:
   - ordinary valid lowercase `a` tags become `referenced-address`;
   - valid NIP-22 kind-1111 `A` and `a` tags retain distinct root and parent
     address semantics rather than entering the immutable-event conversation
     graph.
   Invalid address-looking tags remain raw canonical tags and must not create
   a typed address subject.
5. Add the smallest collection navigation routes needed to move from events to
   referenced addresses and from addresses to their current locally resolved
   events. Preserve relationship reasons, canonical tag evidence, provenance,
   and honest unresolved results.
6. Make the new subject and routes visible through the existing factual and
   contextual schemas. Keep plans, direct execution, and sessions on the same
   normalized executor.
7. Confirm that an explicit ordinary acquisition filter using `#a` still
   accepts a canonical coordinate. Do not add automatic acquisition or a
   task-specific networking command.
8. Update durable project and package documentation only where the public
   subject and navigation model changed.

## Acceptance criteria

- Address equality depends only on the canonical coordinate, never on a relay
  hint or a currently resolved event ID.
- Resolving an address chooses the same current event as the existing
  replaceable-event rules.
- Buffer/archive turnover changes evidence resolution honestly without
  changing address identity.
- Event-to-address-to-current-event navigation is available through the
  established collection operations and explains every transition.
- NIP-22 address roots and parents do not silently become NIP-10 event edges.
- Existing event, account, and tag behavior remains compatible.
- No hidden relay contact, persistence, universal event-kind registry, or
  second operation language is introduced.

## Verification

- Permanent tests expected: yes.
- Stable public behavior protected: address validation and identity; current
  replaceable resolution; typed `a`/`A` relationships; public collection,
  inspection, schema, and explicit `#a` behavior.
- Prefer extending one existing public-boundary protocol/navigation scenario
  over helper-level tests.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: live relay tests, TCP/TLS/WebSocket mechanics, UI,
  NIP-19 decoding, and automatic use of relay hints.
