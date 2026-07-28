---
id: 070-normalized-event-attachments
status: ready
max_attempts: 4
validation: workflow/tasks/070-normalized-event-attachments.validate.sh
depends_on: 069-event-content-facts
---

# Add normalized event attachments and composable media facts

## Authority

Implement Task 2 from
[`EVENT-CONTENT-ENGINE-DESIGN.md`](../../EVENT-CONTENT-ENGINE-DESIGN.md).
Use its exact attachment shape, construction rules, vocabulary, bounds, and
precedence. Do not create global attachment identity or storage.

## Goal

Allow a researcher to filter, explode, and aggregate declared and inferred
event attachments using ordinary relation operations.

## Required work

1. Extend the event-content interpretation module to parse and merge NIP-92,
   NIP-94, dedicated picture/video/voice kinds, podcast audio tags, and
   supported URL inference.
2. Normalize one attachment per primary URL with the documented required and
   optional fields. Preserve multiple MIME types, families, sources, hashes,
   fallbacks, unknown values, and conflicts.
3. Enforce the documented deterministic 20-attachment and per-array bounds.
   Expose complete `event.attachmentCount` and `event.attachmentsOmitted`.
4. Expose lazy relation fields:
   `event.mediaFamilies`, `event.mediaSources`,
   `event.attachmentCount`, `event.attachments`,
   `event.attachmentsOmitted`, and the existing `event.hasMedia`.
5. Remove the old independent `hasMedia` implementation. Derive the
   compatibility boolean from the same interpretation.
6. Extend generic `explode` so a plain-object array element exposes one level
   of named fields such as `attachment.url` and `attachment.families`.
   Do not recursively flatten objects or add a media-specific operation.
7. Never fetch attachment URLs, follow redirects, inspect headers, or mutate
   canonical events.
8. Update schema and documentation through the existing relation vocabulary.

## Acceptance criteria

- `relate → explode event.attachments` yields filterable named attachment
  properties and retains source-event evidence.
- Declared, inferred, conflicting, and unknown facts remain distinguishable.
- Dedicated format intent remains separate from attachment validity.
- URL inference never masquerades as declared metadata.
- Buffer turnover and unresolved evidence behave like other source fields.
- No attachment store, persistence, downloader, MIME framework, scoring,
  rendering, or new operation is introduced.

## Verification

- Extend a public relation scenario with representative declared, inferred,
  conflicting, malformed, duplicate-URL, and bounded attachment evidence.
- Verify generic object explosion independently of media-specific naming.
- Do not add one permanent test per MIME, extension, host, kind, or metadata
  property.
- Run syntax checks, the functional suite, and browser smoke validation.
