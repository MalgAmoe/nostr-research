---
id: 059-inline-nostr-reference-navigation
status: done
max_attempts: 4
validation: workflow/tasks/059-inline-nostr-reference-navigation.validate.sh
depends_on: 058-nostr-reference-decoding
---

# Navigate inline Nostr references found in event content

## Goal

Make valid NIP-27 inline `nostr:` references in canonical event content
available as derived, explainable navigation edges while leaving the source
content untouched and acquisition fully explicit.

## Required work

1. Reuse the decoder from task 058 to recognize valid NIP-27 `nostr:` URIs in
   event content. There must not be a second bech32 or subject parser.
2. Derive distinct inline relationships to account, immutable-event, and
   address subjects. Preserve:
   - the canonical source event;
   - the original matched text and bounded content position;
   - decoded author, kind, and relay hints as attributed suggestions; and
   - observation provenance.
3. Invalid, unsupported, private, and oversized reference-looking strings
   remain ordinary content and do not create navigation edges.
4. Include inline relationships in the established referenced-account,
   referenced-event, and referenced-address navigation groups without adding
   them to reply/conversation graphs.
5. Ensure `move`, traversal, continuation where already applicable,
   inspection, explanation, collection presentation, and relation extraction
   expose the new edges through existing result shapes.
6. Keep derivation bounded by the canonical event content already resident in
   memory. Do not fetch, render, rewrite, or recursively parse referenced
   content.
7. Preserve relay and author hints as evidence only. A later caller may choose
   explicit acquisition parameters; the library must not change configured
   relays or issue a request automatically.
8. Update factual schema and documentation only where needed to expose the
   new observable relationship types.

## Acceptance criteria

- Inline account, event, and address references become navigable through the
  same subject collections used for tag-derived references.
- Every derived membership is explainable back to the exact canonical source
  event and inline token.
- Inline references never become thread edges solely because they target an
  event.
- Duplicate inline references are deterministic and do not multiply a stable
  collection member while still retaining adequate reasons.
- Malformed or unsupported text does not create false subjects.
- No hidden acquisition, content rendering, moderation, URL ontology, or
  second navigation API is introduced.

## Verification

- Permanent tests expected: yes.
- Stable public behavior protected: NIP-27 recognition, typed navigation,
  evidence explanation, deduplication, and rejection of false inline matches.
- Extend a public-boundary protocol/navigation scenario rather than importing
  decoder or relationship helpers directly.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: live networking, regex micro-tests, rendering,
  browser-link handling, media previews, and recursive content acquisition.
