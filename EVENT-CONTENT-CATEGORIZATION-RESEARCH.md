# Event content categorization and warning research

Date: 2026-07-28

## Purpose

This investigation asks what the engine can honestly expose about:

1. the protocol-defined role or format of an event;
2. media contained in or attached to an event; and
3. warnings, labels, and reports concerning its content.

It does not define moderation policy, infer subject matter, or decide what a
researcher should avoid. The goal is factual structure that remains useful for
different research paths.

## Settled product decision

The application will exclude an event by default when the event itself carries
either:

- a NIP-36 `content-warning` tag; or
- a NIP-32 self-label whose namespace is `content-warning`.

This is intentionally blunt. The project is not a general-purpose client and
does not need to reveal warned content. A future configuration may disable the
default, but no warning vocabulary or reason-specific policy is required.

The default does **not** silently apply third-party kind-1985 labels or
kind-1984 reports. Doing that would require selecting whose claims to trust
and acquiring claims that may not be resident. Those events remain ordinary
attributed research evidence.

## Sources and method

The protocol review used the current official Nostr NIPs and event-kind index,
especially:

- [the official event-kind table](https://github.com/nostr-protocol/nips#event-kinds);
- [NIP-23 long-form content](https://github.com/nostr-protocol/nips/blob/master/23.md);
- [NIP-32 labeling](https://github.com/nostr-protocol/nips/blob/master/32.md);
- [NIP-36 sensitive content and content warnings](https://github.com/nostr-protocol/nips/blob/master/36.md);
- [NIP-56 reporting](https://github.com/nostr-protocol/nips/blob/master/56.md);
- [NIP-68 picture-first feeds](https://github.com/nostr-protocol/nips/blob/master/68.md);
- [NIP-71 video events](https://github.com/nostr-protocol/nips/blob/master/71.md);
- [NIP-92 media attachment metadata](https://github.com/nostr-protocol/nips/blob/master/92.md);
- [NIP-94 file metadata](https://github.com/nostr-protocol/nips/blob/master/94.md);
- [NIP-A0 voice messages](https://github.com/nostr-protocol/nips/blob/master/A0.md);
- [NIP-F4 podcasts](https://github.com/nostr-protocol/nips/blob/master/F4.md).

The live trial used the existing declarative JSONL session and generic
relation operations. It contacted `wss://nos.lol`,
`wss://relay.primal.net`, and `wss://relay.snort.social` with explicit bounds.
One relay intermittently failed in later acquisitions, so every count below
describes only the bounded observed sample, never relay-wide prevalence.

No prospective classification rules were added to the engine during the
trial.

## The protocol exposes several independent dimensions

There is no single Nostr field that classifies an event as text, image, audio,
or video. At least four dimensions must remain separate.

### 1. Event role or format

The kind can give an event an intended protocol role. Research-relevant
examples include:

| Kinds | Protocol role or format |
| --- | --- |
| `1` | Short text note, which may also contain attachments |
| `9`, `24`, `42`, `1311` | Different public-message or chat forms |
| `11` | Forum thread |
| `20` | Picture-first event |
| `21`, `34235` | Video event |
| `22`, `34236` | Short portrait video event |
| `54` | Podcast episode |
| `1063` | File metadata |
| `1111` | Comment |
| `1222`, `1244` | Voice message and voice-message comment |
| `1337` | Code snippet |
| `1984` | Report |
| `1985` | Label |
| `30023` | Long-form Markdown content |
| `30311` | Live event |
| `30402` | Classified listing |

This is an open registry, not a closed enum. Unknown and application-defined
kinds are normal. A useful engine projection must therefore recognize a
bounded set of known formats while preserving the exact kind and reporting
unrecognized kinds as unknown rather than forcing them into the nearest
category.

The event role is not its media type. A kind-1 note may contain an image; a
video event can contain text, video variants, separate audio tracks, and a
preview image; a long-form article may have a title image and inline Markdown
media.

### 2. Declared attachment facts

NIP-92 `imeta` tags attach metadata to URLs in event content. Their entries
can include:

- primary and fallback URLs;
- MIME type;
- hashes;
- dimensions;
- alternative text;
- preview images;
- blurhash or thumbhash;
- duration, bitrate, and waveform where applicable; and
- service or storage information.

NIP-94 kind `1063` events expose similar file facts as ordinary tags. These
can describe images, audio, video, archives, executable files, documents, or
other arbitrary data.

MIME type is the strongest general media-family signal when present:

- `image/*`;
- `video/*`;
- `audio/*`;
- another file type; or
- malformed/unknown.

An `imeta` attachment without a MIME entry is still a declared attachment,
but its family is unknown unless another piece of evidence supports an
inference.

### 3. Inferred media facts

Many kind-1 notes contain only a URL and do not carry structured metadata.
File extensions and recognizable hosts can provide useful hints, but these
are inferences:

- an extension may be absent or misleading;
- a URL may redirect;
- a page may embed media without being the media file;
- a known media host can serve several formats; and
- clients do not implement the NIPs consistently.

The engine should never present URL inference as equivalent to declared MIME
metadata or a dedicated event kind.

### 4. Warning and moderation evidence

Four different mechanisms appeared in the protocol review and live data.

#### NIP-36 author content warning

An event can contain:

```json
["content-warning", "<optional free-form reason>"]
```

The warning applies to the event as a whole. It is authored with the event and
does not identify a particular attachment. The reason is optional and has no
standard enumeration.

#### NIP-32 self-label

An ordinary event can carry `L` namespace and `l` label tags. On a non-1985
event, these labels refer to the event itself. Labels and namespaces are open
strings, although publishers are encouraged to use unambiguous vocabularies.

#### NIP-32 third-party label

A kind `1985` event can label one or more referenced events, accounts,
addresses, relays, URLs, or topics. This is a claim by the label-event author,
not an intrinsic property of the target. The target and the label author's
identity must remain attached to the evidence.

#### NIP-56 report

A kind `1984` event reports an account, event, or blob. Unlike NIP-36 reasons,
NIP-56 defines a small report vocabulary:

- `nudity`;
- `malware`;
- `profanity`;
- `illegal`;
- `spam`;
- `impersonation`; and
- `other`.

Reports are subjective and can be gamed. They are attributed evidence, not
automatic filtering truth.

## Live trial observations

### Broad unfiltered window

The first acquisition observed 1,000 relay deliveries representing 645
distinct events. It contained 78 event kinds. Its highest-volume kinds were
mostly machine or application activity rather than human-readable notes.
This confirms that a generic event-role projection would help describe the
field before a researcher decides what to retain.

### Targeted content-format window

The second acquisition requested kinds:

`1`, `20`, `21`, `22`, `54`, `1063`, `1222`, `1244`, `30023`, `34235`,
and `34236`.

It observed 1,000 relay deliveries representing 792 distinct subjects:

| Observed kind | Count |
| --- | ---: |
| `1` short note | 675 |
| `30023` long-form | 87 |
| `1063` file metadata | 27 |
| unresolved after buffer turnover | 3 |

No picture, video, podcast, or voice-message kinds appeared in this particular
bounded window. This does not demonstrate relay-wide absence. It does show
that ordinary notes with attachments matter more to the immediate research
workflow than relying exclusively on dedicated media kinds.

The current `event.hasMedia` projection returned:

| Current projection | Count |
| --- | ---: |
| `true` | 244 |
| `false` | 545 |
| unresolved after turnover | 3 |

Thirty-six sampled events had `imeta` tags. The inspected examples were mostly
image attachments with `image/jpeg` or `image/png`, commonly accompanied by
dimensions. At least one `imeta` had a URL but no MIME type. The 25 top-level
`m` tags in the bounded exploded-tag window all said
`application/octet-stream` and came from one prolific author, illustrating
both noisy data and the danger of treating `m` as a media family without
retaining the exact value and provenance.

The 1,000-row bound on exploded tags means these counts are descriptive, not
complete even for the 792-event acquisition.

### Warning and label window

A relay query for `#L = content-warning` observed 410 distinct events. The
sample mixed:

- 90 third-party kind-1985 label events;
- self-labeled long-form, video, picture, file, and ordinary note events; and
- events that also carried direct `content-warning` tags.

Within the bounded exploded-tag window, 38 direct NIP-36 warnings had these
free-form reasons:

| Reason | Uses |
| --- | ---: |
| `drugs` | 10 |
| `profanity` | 9 |
| empty | 6 |
| `sexual` | 3 |
| `spoiler` | 2 |
| `hate` | 2 |
| `porn` | 1 |
| `violence` | 1 |
| `alcohol` | 1 |
| `the truth` | 1 |
| `AI boobage` | 1 |
| `content-warning` | 1 |

This confirms that NIP-36 reasons must remain raw strings. They are not a
protocol taxonomy.

Namespaced `l` values marked with the `content-warning` namespace included:

`drugs`, `profanity`, `porn`, `hate`, `sexual`, `graphic-media`, `violence`,
`alcohol`, `tobacco`, `nudity`, `self-harm`, `gambling`, `harassment`,
`ai-generated`, `deepfake`, `scam`, `spoiler`, `misleading`,
`flashing-lights`, `spam`, and free-form outliers.

This looks like an emerging client vocabulary, not a NIP-defined closed set.
The engine can expose and aggregate it, but must not silently normalize it
into authoritative categories.

## What the current engine gets right

- It retains raw kind, content, and tags.
- Generic `explode`, `filter`, `aggregate`, and `show` operations were enough
  to conduct the trial.
- Exact source event subjects and authorship remain available.
- `event.links`, `event.domains`, and `event.hasMedia` provide useful initial
  visibility.
- The bounded buffer and presentation explicitly exposed turnover and
  unresolved evidence rather than silently retaining stale events.

## What is genuinely missing

### Event-format visibility

The exact numeric kind is available, but the caller must know the registry.
The engine lacks a factual, open-ended projection of the known protocol role
or content format.

### Structured attachment visibility

`event.hasMedia` collapses too much information. The caller cannot directly
ask which media family was observed, how it was detected, how many
attachments exist, or which structured fields were supplied.

### Warning visibility

The caller must manually explode raw tags. There is no direct projection that
distinguishes:

- a warning authored with the event;
- a self-label authored with the event;
- a third-party label targeting the event;
- a report targeting the event or its author; and
- absence of warning evidence.

### Evidence strength and source

The current boolean merges protocol declarations and heuristics. A future
projection must identify whether a fact came from:

- a dedicated kind;
- NIP-92 `imeta`;
- a top-level MIME or media-specific tag;
- a URL extension;
- a recognized host; or
- a separate attributed label/report event.

## Candidate engine boundary

The trial supports three small, orthogonal projections. Their final names and
shapes should be decided only after an implementation design pass.

### A. Known event format

Expose:

- exact kind;
- a known format name when the engine recognizes it;
- a broad role such as content, conversation, profile/metadata,
  relationship, reaction, moderation/assertion, transactional/application, or
  unknown; and
- the NIP or registry basis for a recognized interpretation.

This mapping must be sparse and open-ended. Unknown kinds remain unknown.

The deeper protocol review suggests that one field is not enough. The useful
minimal decomposition is:

- `event.role`: what the event does in the protocol;
- `event.format`: how its primary human-facing content is structured; and
- `event.conversationRole`: whether it is an original, reply/comment, quote,
  repost, chat message, or not conversational.

These are factual conveniences, not a hierarchy of quality.

Candidate `role` values should remain broad:

- `content`;
- `profile-metadata`;
- `relationship`;
- `interaction`;
- `moderation`;
- `application`;
- `transaction`;
- `encrypted`;
- `unknown`.

Candidate `format` values should describe only formats the engine genuinely
knows:

- `plain-text`;
- `long-form-markdown`;
- `picture-first`;
- `video`;
- `short-video`;
- `voice-message`;
- `podcast-episode`;
- `file-metadata`;
- `code`;
- `poll`;
- `live-activity`;
- `listing`;
- `other`;
- `unknown`.

Not every event has a meaningful human content format. A follow list, deletion
request, zap receipt, authentication event, or application-data event should
not be called text merely because its JSON `content` field is a string.

Conversation role must be interpreted separately:

- a kind-1 event without a reply marker can be an original note;
- a kind-1 event with NIP-10 root/reply markers is a reply;
- kind `1111` is a cross-kind comment;
- kind `6` and kind `16` are repost containers rather than copies of the
  original content category;
- a quote is indicated through `q`/reference structure and can still contain
  original text and attachments;
- chat and public-message kinds are messages even when they look like short
  text.

This separation avoids misleading categories such as treating a reposted
video as a text event because the outer kind is a repost, or treating every
string-bearing machine event as a note.

### B. Attachment facts

Expose a bounded list or explodable relation containing:

- URL;
- observed MIME value;
- derived media family (`image`, `video`, `audio`, `file`, `unknown`);
- available dimensions, duration, hashes, alt text, previews, and fallbacks;
- evidence mechanism (`imeta`, file-metadata tag, dedicated kind, or URL
  inference); and
- confidence class (`declared` or `inferred`), not a numerical score.

`event.hasMedia` can remain as a convenience derived from these facts.

Do not add `isTextOnly`. Failure to observe media is not proof that an event
contains only text.

An event may expose several simultaneous media families. The engine should
therefore expose `mediaFamilies` as a set rather than a single winning
category. Examples include:

- a video with a preview image and separate audio track;
- a long-form article with images;
- a kind-1 caption with multiple images;
- a file-metadata event describing an archive with a preview image; and
- an attachment whose family cannot be determined.

`mixed` can be a presentation summary, but should not replace the underlying
families.

Dedicated kinds express publishing intent, not proof that their payload is
valid. A kind-21 event with no usable video attachment remains
`format: video` while its attachment facts report missing or malformed media.
Conversely, a kind-1 event with declared `video/mp4` remains
`format: plain-text` with `mediaFamilies: ["video"]`.

Attachment detection should use this precedence without hiding conflicts:

1. structured MIME in `imeta`;
2. kind-specific structured media tags;
3. NIP-94 MIME metadata;
4. dedicated-kind implication;
5. URL extension inference;
6. host-based inference.

When two sources disagree, retain both observed claims and mark the
classification as conflicting rather than choosing silently.

### C. Attributed sensitivity facts

Expose direct warning facts separately from external claims:

- direct NIP-36 warning presence and raw reason;
- self-label namespace and value;
- third-party label author, namespace, value, and target;
- report author, standardized report type, and target; and
- exact source event for every claim.

No default should automatically discard an event. Filtering is an explicit
researcher operation over these facts.

## Questions for another trial or design pass

1. Should known event-format facts be fields on every related event, or a
   separate explorable interpretation relation?
2. Which attachment properties are common enough to deserve normalized
   fields, and which should remain raw key/value metadata?
3. Should dedicated picture/video/voice kinds imply a media family when their
   required attachment metadata is malformed or absent? The kind proves
   intent, not successful media delivery.
4. How should external label/report events be joined to targets without
   silently fetching or globally trusting them?
5. Do repeated real-world warning strings justify optional normalization
   aliases, or is raw exact matching sufficient for the vessel?
6. Should content format and protocol role share one projection, or are they
   clearer as two fields?

## Recommendation

The evidence is sufficient to recognize a real engine gap, but not yet to
implement one large classifier.

The next step should be a design task that defines the smallest factual
representation for:

1. known event role/format;
2. structured attachment facts with declared-versus-inferred provenance; and
3. direct warnings versus attributed labels and reports.

Implementation should then be split so that attachment interpretation cannot
accidentally introduce moderation policy, and warning/report interpretation
cannot silently alter acquisition or corpus membership.
