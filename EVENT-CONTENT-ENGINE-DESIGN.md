# Event content engine design

Date: 2026-07-28

Status: design settled enough for milestone and workflow task definitions.

This document translates
[EVENT-CONTENT-CATEGORIZATION-RESEARCH.md](./EVENT-CONTENT-CATEGORIZATION-RESEARCH.md)
into a change that fits the current library. It is not an implementation task.

## One interpretation module

Add one dependency-light `event-content.js` module with this conceptual
interface:

```text
describeEventContent(event)
hasSelfContentWarning(event)
```

The implementation owns known-kind facts, NIP-10/NIP-22 conversation facts,
NIP-92 and NIP-94 parsing, kind-specific media tags, URL inference, attachment
merging, and direct warning detection.

Canonical events remain immutable. The module returns replaceable derived
facts and owns no memory.

## Derived relation fields

`relate` gains source-backed fields:

```text
event.role
event.format
event.conversationRole
event.mediaFamilies
event.mediaSources
event.attachmentCount
event.attachments
event.attachmentsOmitted
event.hasMedia
```

`event.hasMedia` remains, but is derived from the same interpretation rather
than a second implementation.

The fields resolve lazily from current canonical evidence. They become
unresolved after buffer/archive evidence becomes unavailable, exactly like
the existing event fields.

## Initial known-kind facts

The mapping is deliberately sparse and open-ended. The exact kind is always
available. An unlisted kind produces `unknown` rather than a guess.

| Kind | Role | Format | Default conversation role |
| --- | --- | --- | --- |
| `0` | `profile-metadata` | `none` | `none` |
| `1` | `content` | `plain-text` | derived from NIP-10 |
| `3` | `relationship` | `none` | `none` |
| `5` | `moderation` | `none` | `none` |
| `6`, `16` | `interaction` | `none` | `repost` |
| `7`, `17` | `interaction` | `none` | `reaction` |
| `9`, `24`, `42`, `1311` | `content` | `plain-text` | `chat-message` |
| `11` | `content` | `plain-text` | `original` |
| `13`, `14`, `15`, `1059` | `encrypted` | `unknown` | `none` |
| `20` | `content` | `picture-first` | `original` |
| `21`, `34235` | `content` | `video` | `original` |
| `22`, `34236` | `content` | `short-video` | `original` |
| `54` | `content` | `podcast-episode` | `original` |
| `1063` | `content` | `file-metadata` | `original` |
| `1068` | `content` | `poll` | `original` |
| `1111` | `content` | `plain-text` | `comment` |
| `1222` | `content` | `voice-message` | `original` |
| `1244` | `content` | `voice-message` | `comment` |
| `1337` | `content` | `code` | `original` |
| `1984`, `1985` | `moderation` | `none` | `none` |
| `30023` | `content` | `long-form-markdown` | `original` |
| `30311` | `content` | `live-activity` | `original` |
| `30402` | `content` | `listing` | `original` |

This first table does not attempt to name every registered kind. Future kinds
are added only when trials need their interpretation.

### Kind-1 conversation role

Call the existing exported `deriveEventRelationships(event)` interpretation
rather than inventing a second NIP-10 parser:

- a resolved NIP-10 reply edge means `reply`;
- a quote edge without a reply edge means `quote`;
- otherwise `original`.

If malformed or ambiguous legacy tags prevent a reliable decision, use
`unknown`, not `original`.

## Normalized attachment shape

One attachment represents one primary URL in one source event:

```json
{
  "url": "https://example.test/image.jpg",
  "families": ["image"],
  "mimeTypes": ["image/jpeg"],
  "classification": "declared",
  "sources": ["imeta"],
  "width": 1200,
  "height": 800,
  "durationSeconds": null,
  "alt": "Sunset",
  "hashes": ["..."],
  "fallbackUrls": []
}
```

Required fields are `url`, `families`, `mimeTypes`, `classification`, and
`sources`. Optional scalar metadata is represented by `null`; optional
multi-value metadata uses an empty array.

Allowed families:

```text
image
video
audio
file
unknown
```

Allowed classifications:

```text
declared
inferred
conflicting
unknown
```

Initial sources:

```text
imeta
file-metadata
picture-kind
video-kind
voice-kind
podcast-audio-tag
url-extension
known-host
```

These are evidence mechanisms, not confidence scores.

### Construction rules

1. NIP-92 `imeta` requires a primary `url`. An `imeta` tag without one does
   not create an attachment.
2. NIP-94 kind `1063` uses its top-level `url` as the primary URL.
3. Voice-message content and podcast `audio` tags are kind-specific primary
   URLs.
4. Content URLs not already represented may create inferred attachments when
   their extension or host provides a known media hint.
5. Exact normalized URL string is the per-event merge key. Hashes do not
   create global attachment identity.
6. Repeated evidence for the same URL is merged. MIME types, families,
   sources, hashes, and fallbacks are distinct ordered sets.
7. Declared MIME and the dedicated kind can coexist. A dedicated format with
   no usable URL still affects `event.format` but creates no fabricated
   attachment.
8. Contradictory declared families make the attachment `conflicting`.
   Declared evidence takes precedence over inference for the summary
   classification, but the inferred source remains visible.
9. Unknown MIME values are retained exactly and map to family `file` unless
   they are malformed, in which case the family is `unknown`.
10. Do not download URLs, follow redirects, inspect HTTP headers, or probe
    media.

### Bounds

- Interpret all tags and content URLs in the accepted canonical event when
  computing summaries.
- Return at most 20 normalized attachments per event.
- `event.attachmentCount` reports the complete derived count.
- `event.attachmentsOmitted` reports the number omitted from the returned
  array.
- Retain at most 20 values in each attachment array.
- Bound `alt` to the existing derived-string limit.
- Keep primary URLs intact; ordinary presentation response-size bounds remain
  responsible for output truncation.

The returned attachment order is primary declaration order followed by
previously unseen content-URL order. This makes bounded omission deterministic.

## Generic object explosion

The existing `explode` operation exposes positional fields only when an array
element is itself an array. Extend it generically:

```text
explode event.attachments as attachment
```

For a plain-object element, expose one level of properties:

```text
attachment
attachment.url
attachment.families
attachment.mimeTypes
attachment.classification
attachment.sources
attachment.width
attachment.height
attachment.durationSeconds
attachment.alt
attachment.hashes
attachment.fallbackUrls
```

Do not recursively flatten nested objects. This is a generic relation
improvement, not a media operation.

## Content-warning exclusion

Default session acquisition configuration:

```json
{
  "acquisition": {
    "excludeContentWarnings": true
  }
}
```

An event is excluded when it carries:

- any direct `content-warning` tag, regardless of reason; or
- `["L", "content-warning"]` together with an `l` tag marked with the same
  namespace.

Kind-1985 labels and kind-1984 reports do not trigger this filter. They are
third-party attributed evidence.

The check occurs after canonical validation and exact requested-filter
matching, but before acquisition budget accounting and memory ingestion.
Excluded events therefore do not consume accepted-observation or
distinct-event budgets and cannot evict resident evidence.

Add `excludedContentWarnings` to operation-wide and per-relay acquisition
counts. The report retains only the count, not identifiers, content, reasons,
or attachments from excluded events.

All relay-backed paths must pass the same setting to the one acquisition
implementation: direct acquisition, hydration, continuation, relation-backed
fetch, plans, and sessions.

Configuration precedence remains:

```text
engine default
→ session acquisition configuration
→ explicit command override
```

## Code touchpoints

Expected modules:

- new `src/event-content.js`: all interpretation and warning knowledge;
- `src/relation.js`: source fields, lazy resolution, generic object explosion,
  and removal of the old independent `hasMedia` helper;
- `src/acquire.js`: option normalization, exclusion point, counts, and
  propagation through bound acquisition;
- `src/configuration.js`: acquisition default and boolean normalization;
- `src/contract-facts.js` and `src/operations.js`: factual command/schema
  visibility where acquisition options are described;
- `src/interpreter.js` and `src/presentation.js`: completeness and bounded
  acquisition reporting;
- public exports only if direct content interpretation is deliberately made
  part of the library interface. It need not be exported merely for tests.

Memory should not change. It continues to own raw canonical evidence and
derived relationship indexes.

## Verification policy

Permanent verification should remain at public interfaces.

1. One relation functional scenario ingests constructed, correctly signed
   canonical events through public memory, relates them, and verifies:
   known/unknown formats, reply/repost roles, declared and inferred
   attachments, conflict retention, deterministic attachment bounds, and
   generic object explosion.
2. Extend one existing acquisition functional scenario to verify that direct
   and self-labelled warnings are excluded and counted while an unmarked event
   is acquired.
3. Exercise the same acquisition setting through the declarative session so
   configuration and schema cannot drift.
4. Do not add permanent network tests or one test per kind, extension, MIME,
   or metadata key.
5. After implementation, run one bounded live-relay trial as task validation.

## Proposed milestone structure

One milestone, three tasks:

1. **Event role and conversation facts** — add the interpretation module,
   sparse kind table, conversation derivation, relation fields, and factual
   schema visibility.
2. **Normalized attachments** — parse and merge attachment facts, derive media
   summaries and `hasMedia`, add generic object explosion, and verify bounded
   composition.
3. **Default warning exclusion** — add configuration, shared warning
   detection, pre-ingestion exclusion, honest counts, presentation/schema
   visibility, and documentation.

The tasks are ordered because attachment interpretation reuses the module from
task 1, and warning exclusion then reuses the same settled interpretation
owner without making acquisition responsible for parsing Nostr content tags.
