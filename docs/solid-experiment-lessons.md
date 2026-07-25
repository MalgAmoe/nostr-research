# Lessons retained from the first interactive experiment

The removed Solid application was an exploratory prototype, not a product
foundation or reference implementation. It was useful for discovering the
research problem, but its browser state, controllers, scoring formulas, and UI
structure should not shape the next application.

Git history retains its implementation. This document retains only the ideas
worth reconsidering through the library and a new interactive research
playground.

## Relay acquisition

- Inspect NIP-11 relay information, including advertised supported NIPs and
  limitations such as maximum query size.
- Read NIP-65 kind-10002 relay lists and distinguish read and write relays.
- Treat explicit relay hints, account-advertised relays, and configured
  fallbacks as different evidence when planning an acquisition.
- Split large time ranges into bounded slices rather than relying on one large,
  newest-biased relay query.
- Preserve per-relay success, empty result, timeout, closure, and failure as
  distinct outcomes.

These are requirements to investigate, not a retained relay-ranking policy.
The prototype's hard-coded relay lists and cache behavior are deliberately
discarded.

## Evidence interpretation and views

- Preserve the distinction between regular, replaceable, ephemeral, and
  addressable events.
- Continue interpreting NIP-10 and NIP-22 relationships conservatively,
  keeping inferred relationships visibly different from marker-based ones.
- Account for deletion requests and replaceable-event ordering when presenting
  current views without rewriting immutable evidence.
- Extract URLs, media types, domains, tags, relay hints, and human-readable
  event-kind descriptions as derived, regenerable views.
- Exact-content fingerprints and independent-author counts are useful lenses
  for understanding duplicated publication and spam. They are not universal
  quality judgments.

## Research playground

- A researcher needs a temporary working selection distinct from durable
  evidence and deliberately saved research sets.
- From any selection, the same broad actions should remain available: inspect,
  include, exclude, traverse, acquire missing evidence, compare, branch, and
  retain.
- Notes, accounts, follow lists, conversations, tags, domains, relays, media,
  and derived groups are alternative ways to view and navigate the same
  evidence.
- Account discovery is most useful when the reason for a candidate is visible,
  such as conversation participation or overlap among selected follow lists.
  The prototype's opaque editorial scores are rejected.
- Local moderation choices—account, name-pattern, topic, word, event, or relay
  exclusions—may be useful session or user state. They must not be presented
  as universal classifications.
- Usage feedback should help evaluate real research activity, but telemetry
  design belongs to the new application and must not copy the prototype's
  append-only browser logging automatically.

## Presentation

- Render Nostr identifiers, profiles, formatted note text, links, images,
  video, audio, and `imeta`/Blossom references as usable content rather than
  raw event JSON.
- Always retain access to canonical events, tags, protocol interpretation, and
  provenance beneath the readable view.
- Loading, partial relay completion, missing evidence, and acquisition scope
  must be visible at the moment they matter.
- Navigation must preserve the working selection and allow returning to an
  earlier point without turning every click into durable research history.

## Deliberately discarded

- The Solid application structure and monolithic application controller.
- IndexedDB and localStorage research persistence.
- Browser session serialization formats and compatibility handling.
- Relay Pulse scoring, account roles, topic scores, and neighborhood scores.
- The old search builder, Relay Explorer, investigation-step UI, and activity
  trail.
- Generated development keys, local usage logs, built assets, and obsolete
  tests tied to the prototype.

