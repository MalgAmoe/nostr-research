# Nostr protocol and relay capability map

Status: protocol-side audit of the repository on 2026-07-27, updated after the
kind-aware relationship milestone on 2026-07-28.

## Purpose

This document maps how the current research system interacts with Nostr,
which protocol concepts it understands, what it can only expose as raw data,
what is absent, and which additions would materially improve research and
navigation.

It is deliberately not a proposal to implement every NIP. The official NIPs
index explicitly warns that NIPs are not a checklist. The useful question for
this project is:

> Which protocol facts let a researcher acquire better evidence, interpret
> relationships correctly, and choose the next direction without making the
> system silently decide what is interesting or trustworthy?

The audit covers the public library under `packages/nostr-research`, especially
`protocol.js`, `acquire.js`, `memory.js`, `continuation.js`, `relation.js`,
`operations.js`, and the declarative session.

## Executive conclusion

The current system already has a strong protocol-independent research core:

- it validates canonical Nostr events cryptographically;
- explicitly acquires bounded evidence from multiple relays;
- rejects valid events that do not match the requested filter;
- separates relay acquisition from local querying;
- retains per-relay observation provenance;
- understands profiles, follows, authors, ordinary replies, mentions, quotes,
  topic tags, and linked domains;
- navigates those relationships through composable collections and relations;
  and
- keeps protocol evidence separate from researcher judgments.

The system can retain and inspect almost any valid event. The first defect
found by this audit—important event kinds passing through overly generic tag
rules—has now been corrected. Relationship derivation is kind-aware, and
reposts, reactions, and deletion requests no longer enter reply graphs.
Address coordinates are now stable subjects, public NIP-19/NIP-21 references
decode with attributed hints, and valid bounded NIP-27 inline references form
typed navigation edges.

It can also explicitly retrieve bounded NIP-11 relay information through the
shared direct, plan, session, JSONL, and browser execution path. Those
documents remain attributed advertisements and retrieval outcomes remain
separate from WebSocket acquisition observations.
NIP-45 count is also explicit through that path: one filter is sent to each
selected relay, and exact, approximate, diagnostic, refusal, and failure facts
remain relay-local rather than becoming a global total.

The most valuable protocol work is therefore, in order:

1. preserve the completed kind-aware relationship and reference interpretation;
2. preserve explicit relay advertisements, completion hints, and diagnostics;
3. add explicit relay search and count operations where relays advertise them;
4. represent deletion, expiration, labels, reports, and identity proofs as
   attributed evidence rather than hidden policy; and
5. interpret selected list and profile conventions that help people discover
   accounts and groups.

Publishing, private messages, wallets, payments, and automatic trust or relay
ranking do not currently serve the research core.

## Three different meanings of support

Nostr support must be described at three levels.

| Level | Meaning | Current consequence |
| --- | --- | --- |
| Canonical readability | A valid signed event can be received, retained, shown, scanned, and inspected as raw fields and tags. | Broadly supported for ordinary NIP-01 events. |
| Semantic interpretation | The system understands what the kind and tags mean and derives correct typed relationships or status. | Supported for a useful but incomplete subset. |
| Protocol interaction | The system can issue the corresponding relay request or client message and interpret its response. | Mainly NIP-01 `REQ` subscriptions. |

For example, a kind `1063` file-metadata event can be retained and its content
and tags can be scanned. That does not mean NIP-94 is semantically complete:
its file fields are not yet exposed as a structured projection.

This distinction should remain visible in future documentation and schemas.

## Current system map

```text
explicit relay URLs + one NIP-01 filter
                    |
                    v
       one WebSocket per relay attempt
                    |
          EVENT / EOSE / CLOSED
                    |
                    v
  canonical validation + exact filter matching
  + default direct self-warning exclusion
                    |
                    v
     bounded process-local observation buffer
       |              |               |
       |              |               +-- relay observations
       |              +-- derived indexes and relationships
       +-- immutable canonical events
                    |
                    v
  local select -> subject collection -> relation analysis
                    |
                    v
      explicit continuation or another acquisition
```

Acquisition is an explicit operation. A local search never silently contacts a
relay, and an acquisition never claims to have exhaustively indexed a relay.
This separation is correct and should be preserved.

## What the system has now

### Canonical event validation

`protocol.js` validates and verifies events with `nostr-tools`.

It currently checks:

- the NIP-01 event structure;
- a lower-case 64-character event ID;
- a 128-character signature;
- safe non-negative integer kind and timestamp values;
- the event ID/hash relationship; and
- the Schnorr signature.

Validation clones the event rather than rewriting caller-owned evidence.

What this establishes:

- the event is structurally and cryptographically canonical.

What this does not establish:

- that its content is true;
- that the author is the person its profile claims;
- that the relay returned it in response to the correct request;
- that an external identity claim is valid;
- that a label, report, relay advertisement, or score should be trusted; or
- that the event remains the current replaceable version.

The current acquisition path separately verifies filter membership, which is
important because canonical validity alone does not establish request
relevance.

### Relay acquisition

`acquire.js` currently:

- accepts explicit `wss://` relay URLs;
- accepts one normalized NIP-01 filter;
- supports `ids`, `authors`, `kinds`, `since`, `until`, `limit`, and arbitrary
  single-letter tag filters such as `#e`, `#p`, and `#t`;
- opens a WebSocket to each selected relay;
- sends one `REQ` subscription per socket;
- receives `EVENT`, `EOSE`, `CLOSED`, bounded `NOTICE`, and neutral `AUTH`
  challenges;
- sends `CLOSE` during teardown;
- validates every event;
- applies the exact requested filter locally before ingesting it;
- bounds the operation by time, accepted observations, distinct event IDs, and
  concurrency;
- supports cancellation through `AbortSignal`;
- deduplicates canonical events without losing duplicate relay observations;
  and
- reports per-relay outcomes, invalid packets, canonical non-matches,
  duplicates, additions, evictions, and the bound that stopped the operation.

This is a good research acquisition contract. It says what was attempted and
observed without claiming global coverage.

Current limitations:

- only one filter can be sent in a `REQ`; NIP-01 permits several filters whose
  results are combined as an OR;
- every operation creates fresh relay connections instead of reusing one
  connection per relay across sequential subscriptions;
- `OK`, `COUNT`, and other relay messages are not interpreted;
- `NOTICE`, `AUTH`, and `CLOSED` diagnostics are observed but authentication
  responses and authenticated connection state are not implemented;
- relay metadata is not requested through NIP-11;
- the NIP-50 `search` filter field is rejected;
- no event publishing is supported; and
- no relay authentication is supported.

### Acquisition configuration

The library has no built-in default relay list. The session default is an empty
relay array, and callers must configure or pass relays explicitly.

That is a reasonable library default. A future application can supply a small
curated initial set without making those relays universal engine policy.

The current configuration model already supplies the right levels:

- immutable engine bounds;
- memory construction capacities;
- mutable session defaults for future operations; and
- explicit per-command overrides.

Protocol additions should fit those levels instead of creating hidden limits
inside individual operations.

### Local NIP-01 querying

The in-memory selector supports:

- event ID and author-prefix matching;
- event kinds;
- inclusive `since` and `until`;
- arbitrary single-letter tag filters;
- local case-insensitive content substring terms;
- stable newest/oldest ordering; and
- explicit output limits.

Every selected subject carries membership reasons. This is more useful for
research than returning unexplained IDs.

Local text search is not NIP-50 relay search. It examines only resident evidence
and should continue to be named and presented separately.

### Evidence and replaceable events

The buffer retains canonical events until deterministic FIFO eviction.
Replaceable-event resolution is a derived current view:

- kind `0`;
- kind `3`;
- kinds `10000`–`19999`; and
- addressable kinds `30000`–`39999`, keyed by author, kind, and `d`.

The newest `created_at` wins, with the ID as a deterministic tie-breaker.

This is a sound distinction: old canonical versions remain evidence while
resident, but current-state views choose one version. Ephemeral kinds are not
given a special storage policy; they may remain in the renewable buffer as
observations. That is defensible for research, although their ephemeral status
is not currently surfaced.

### Current subjects and navigation

The stable subject model has three types:

- `event`;
- `account`; and
- `tag`.

Current first-class relationships include:

- event author;
- authored events;
- profile metadata;
- follow lists;
- followed accounts and followers;
- reply roots, parents, ancestors, and conversations;
- mentions;
- quoted events;
- referenced events;
- shared tags; and
- linked domains.

The continuation layer can turn these into explicit local or relay-backed
steps. Relay continuation lowers to ordinary filters such as:

- `authors` plus kinds for account notes, profiles, and follow lists;
- kind `3` plus `#p` for followers;
- `#e` for possible replies, conversation members, mentions, and quotes; and
- `ids` for known referenced events.

This is composable and appropriately manual: one step gathers evidence, the
researcher inspects it, and then chooses another step.

### Profiles and follow graphs

The system understands current kind `0` metadata and exposes:

- `name`;
- `display_name`;
- `about`; and
- `nip05`.

It resolves accounts by exact stored name, display name, NIP-05 string, or
public-key prefix.

It understands current kind `3` `p` tags as follows and can navigate both
directions when evidence is resident.

Not yet structured:

- NIP-05 verification;
- `picture`, `banner`, `website`, `bot`, `birthday`, and other profile fields;
- NIP-39 external identity proofs;
- the optional relay hint and petname in kind `3` `p` tags;
- NIP-65 kind `10002` relay lists; and
- NIP-51 follow sets, interest sets, starter packs, mute lists, bookmarks, and
  other curated lists.

The raw events and tags remain inspectable, but these facts are not available
as typed navigation or verification evidence.

### Content and relation analysis

The relation layer exposes generic fields including:

- author, kind, text, timestamp, and tags;
- extracted HTTP(S) links and domains;
- a derived media-presence flag;
- profile fields; and
- observed relays and resolution source.

`event.hasMedia` recognizes media tags, MIME hints, familiar extensions, and
known media hosts. Generic `explode`, `scan`, and `project` operations make all
raw tags and content available without waiting for a dedicated NIP
interpretation.

Not yet structured:

- NIP-23 long-form title, summary, image, and publication metadata;
- NIP-68 picture events;
- NIP-71 video events;
- NIP-92 `imeta` attachment metadata;
- NIP-94 file metadata;
- NIP-36 content warnings; and
- Markdown or client-specific rendering.

Most of these are presentation and richer analysis conveniences, not blockers
to basic research.

## Protocol interpretation map

The table uses these states:

- **implemented**: meaningful protocol behavior exists;
- **partial**: useful behavior exists but material semantics are absent;
- **raw only**: canonical evidence can be inspected but is not interpreted;
- **absent**: the corresponding interaction is not performed.

| Area / NIP | State | Current behavior | Important missing part |
| --- | --- | --- | --- |
| NIP-01 basic events | Implemented | Canonical validation, filters, subscriptions, local selection | Multi-filter OR requests and connection reuse |
| NIP-01 relay messages | Partial | `REQ`, incoming `EVENT`, `EOSE`, `CLOSED`, bounded `NOTICE`, outgoing `CLOSE` | Outgoing `EVENT`, incoming `OK`, connection reuse |
| NIP-02 follow list | Partial | Current kind `3` follows and reverse follower lookup | Relay hints and petnames |
| NIP-05 DNS identifier | Raw only | Stored and searchable profile string | Network verification and returned relay hints |
| NIP-09 deletion request | Partial | Kind `5` event targets are typed and excluded from reply graphs | Validate target authorship and expose deletion status |
| NIP-10 text-note threads | Implemented | Kind-scoped root/reply/mention handling, positional fallback, `q` quotes | Address-form `q` references remain pending |
| NIP-11 relay information | Absent | Caller supplies URLs | Fetch and expose advertised capabilities and limitations |
| NIP-13 proof of work | Raw only | Nonce tag remains available | Derived difficulty as optional evidence |
| NIP-18 reposts | Partial | Kind `6` event targets and kind `16` embedded canonical targets are typed | Addressable repost targets |
| NIP-19 identifiers | Implemented | Public account, event, and address identifiers decode to stable subjects with attributed hints | Additional entity types remain unsupported |
| NIP-21 `nostr:` URI | Implemented | Public NIP-19 identifiers decode when wrapped in `nostr:` | Browser-link handling is outside the library |
| NIP-22 comments | Partial | `E/e` event and `A/a` address roots/parents plus `P/p` account roles are kind-aware | `I/i` and `K/k` scope typing |
| NIP-23 long-form content | Partial | Kind `30023` is a resolvable address subject with historical event evidence | Structured long-form metadata |
| NIP-24 profile/tag conventions | Partial | A small profile subset and generic tags | Website, banner, bot, external identity/title conventions |
| NIP-25 reactions | Partial | Kind `7` event targets and kind `17` external tag targets are typed | First-class addressable and external identities |
| NIP-27 text references | Implemented | Valid bounded inline account, event, and address references form explainable typed navigation edges | Rendering and recursive acquisition are deliberately absent |
| NIP-32 labels | Raw only | Label events can be scanned | Attributed label targets and namespaces |
| NIP-36 content warning | Acquisition policy + raw evidence | Direct self-warnings are excluded by default with count-only accounting and an explicit override; third-party labels/reports remain evidence | Structured warning evidence for admitted events |
| NIP-39 external identity | Raw only | Tags remain visible | Proof verification with provenance and status |
| NIP-40 expiration | Raw only | Expired events remain ordinary evidence | Derived expired status and optional caller filtering |
| NIP-42 relay authentication | Partial | Neutral bounded challenge observation and machine-readable `auth-required` subscription refusal | Signer boundary and authenticated connection state |
| NIP-45 event count | Absent | Must fetch events to learn local counts | Per-relay count request and approximate-result metadata |
| NIP-50 search | Absent | Local substring scan only | Explicit relay search with relay-specific result semantics |
| NIP-51 lists | Raw only | Replaceable versions resolve generically | Typed public lists useful for discovery and moderation |
| NIP-56 reports | Raw only | Kind `1984` remains inspectable | Attributed report relationships; never implicit truth |
| NIP-62 vanish request | Raw only | Request can be retained | Expose request status without rewriting historical evidence |
| NIP-65 relay list metadata | Raw only | Kind `10002` current version resolves | Structured read/write relay claims and explicit routing use |
| NIP-66 relay discovery | Raw only | Events can be scanned | Structured advertised/probed relay observations |
| NIP-67 EOSE hints | Implemented | Attributed bounded `finish`/`more` hints are retained without implying global exhaustiveness | Automatic pagination is deliberately absent |
| NIP-68 picture events | Raw only | Event and tags remain readable | Structured media projection |
| NIP-70 protected events | Raw only | `-` tag remains visible | Surface protection requirement and auth implications |
| NIP-71 video events | Raw only | Events and tags remain readable | Structured video variants and metadata |
| NIP-73 external content IDs | Raw only | `i`/`I` tags become generic tags | Normalized external subjects and typed references |
| NIP-77 negentropy | Absent | Relay documents may advertise it | Synchronization protocol |
| NIP-85 trusted assertions | Raw only | Assertion events remain inspectable | Attributed assertion type/target; never implicit score |
| NIP-89 app handlers | Raw only | Events can be inspected | App discovery for unknown kinds |
| NIP-92 media attachments | Partial/raw | Media presence may be detected | Structured `imeta` fields and attachment relationships |
| NIP-94 file metadata | Raw only | Kind `1063` retained | Structured file metadata |

### Completed correction: kind-aware tag interpretation

The original relationship index derived reply-like and mention-like edges from
tags across events too broadly.

That is safe only when a tag has the same semantics for the event kind being
interpreted. It does not always:

- NIP-10 threading rules apply to kind `1`;
- kind `6` and `16` use references for repost targets;
- kind `7` and `17` use references for reaction targets;
- kind `5` uses references for deletion requests; and
- kind `1111` uses the distinct NIP-22 root and parent vocabulary.

This was the first protocol problem to fix because it affected the correctness
of existing navigation. It is now implemented as one kind-aware relationship
module rather than a universal NIP framework.

Generic fallback tags should remain visible after typed relationships are
derived. The implementation preserves this rule: interpretation adds a
replaceable view over evidence and does not consume or rewrite source tags.

## Missing first-class identities

The current `event`, `account`, and `tag` subject types cover much of the
existing workflow, but two protocol identities are now limiting navigation.

### Addressable event coordinates

An `a` reference identifies:

```text
kind:pubkey:d
```

It refers to the current version of an addressable event, not one immutable
event ID. Treating it only as a generic tag loses:

- current-version resolution;
- long-form and curated-set navigation;
- addressable repost, reaction, deletion, and comment targets;
- `naddr` navigation; and
- relay acquisition through `#a`.

The system needs a stable address subject or an equally explicit reference
value. It must not pretend that an address coordinate is an immutable event
ID.

### External content identifiers

NIP-22 and NIP-73 allow references to URLs, books, papers, podcasts, geohashes,
blockchain objects, and other external material through `I/i` tags.

For research, these can connect people who discuss the same work even when no
Nostr event is the common target. A normalized external subject is therefore
potentially valuable. It should preserve the namespace and original
identifier, and it should not make a claim about the referenced material.

This is useful after address support, not before it.

## Relay protocol map

| Client/relay message | Current state | Research value |
| --- | --- | --- |
| `REQ` | Implemented with one filter | Core evidence acquisition |
| relay `EVENT` | Implemented and validated | Core evidence |
| `EOSE` | Implemented as attempt boundary | Separates stored results from later live events |
| `CLOSE` | Implemented | Clean bounded operation |
| `CLOSED` | Partially handled | Standardized refusal reason and termination diagnostics |
| `NOTICE` | Implemented | Bounded human-readable relay diagnostics with omission count |
| client `EVENT` | Absent | Publishing; not needed for current research |
| relay `OK` | Absent | Only needed with publishing/auth flows |
| `AUTH` | Observed | Neutral bounded challenge observation, distinct from an auth-required refusal |
| `COUNT` | Implemented with one filter and relay-local outcomes | Estimate scope before expensive acquisition without summing overlapping corpora |
| NIP-67 EOSE hint | Implemented | Attributed `finish`/`more` evidence; no automatic continuation |
| NIP-77 negentropy messages | Absent | Efficient synchronization, not ordinary exploration |

Relay authentication has three distinct evidence sources that must not be
collapsed:

- an `AUTH` message says only that a challenge was observed;
- a standardized `auth-required:` subscription refusal says that the actual
  request required authentication; and
- NIP-11 `limitation.auth_required` is the relay's attributed advertisement,
  not an observed request outcome.

### NIP-11 snapshots from three public relays

The following was fetched directly with
`Accept: application/nostr+json` on 2026-07-27. NIP-11 documents are relay
advertisements, not proof of observed behavior.

| Relay | Software | Advertised NIPs | Advertised limits |
| --- | --- | --- | --- |
| `wss://nos.lol` | strfry `1.1.0` | 1, 2, 4, 9, 11, 28, 40, 45, 70, 77 | `max_limit: 500`, `max_subscriptions: 20`, message length 131072 |
| `wss://relay.primal.net` | strfry `1.0.3-1-g60d35a6` | 1, 2, 4, 9, 11, 22, 28, 40, 70, 77 | `max_limit: 500`, `max_subscriptions: 20`, message length 1000000 |
| `wss://relay.damus.io` | strfry `1.1.0-1-g691a533f11eb` | 1, 2, 4, 9, 11, 28, 40, 45, 70, 77 | `max_limit: 500`, `max_subscriptions: 200`, message length 1000000 |

This small sample already demonstrates why capability inspection matters:

- all three advertise a maximum filter limit of 500;
- only two advertise NIP-45 count support;
- Primal advertises NIP-22 while the other two do not;
- all advertise NIP-77 negentropy; and
- none advertises NIP-50 full-text search.

A relay may implement more or less than it advertises, and optional behavior
can vary. The system should retain both:

- attributed advertised capability from NIP-11; and
- observed outcome from a real request.

It should not collapse them into an unexplained relay quality score.

## What would actually improve research

### Priority 1: correct the graph already exposed — completed

Add kind-aware protocol relationship interpreters for:

- kind `1`: NIP-10 threads, mentions, and quotes;
- kind `1111`: complete NIP-22 comments;
- kinds `6` and `16`: reposts;
- kinds `7` and `17`: reactions; and
- kind `5`: deletion requests.

The completed outcome is not more data. It is fewer false reply/conversation
edges and more honest reasons for navigation membership.

This work should use small, explicit interpreters keyed by event kind. It does
not require a plugin registry or a schema language for NIPs.

### Priority 2: make protocol references navigable

Add:

1. an addressable-event coordinate subject or reference;
2. parsing for NIP-19 identifiers;
3. parsing for `nostr:` URIs and inline NIP-27 references;
4. address-aware continuation using local resolution and explicit `#a`
   acquisition; and
5. retained relay hints as attributed routing suggestions.

This closes a major hole between raw Nostr content and the system's navigation
model. It also allows long-form notes, curated sets, addressable reposts, and
comments to participate without building separate product workflows for each.

Relay hints must never silently expand the configured relay set. They can be
shown as candidate sources or used by an explicit acquisition command.

### Priority 3: make relay behavior visible

Add a narrow relay-information capability:

- fetch and validate a relay's NIP-11 document;
- expose supported NIPs, software/version, limitations, fees, auth
  requirements, and retention claims where present;
- parse `NOTICE`;
- parse the standardized prefix of `CLOSED` messages;
- parse NIP-67 `finish` and `more` EOSE hints; and
- keep advertised facts separate from observed request outcomes.

This is more valuable than hardcoding a large relay list. It lets the
researcher understand why an operation was rejected, truncated, authenticated,
or unlikely to support a requested feature.

Connection reuse may become worthwhile at the same seam. One connection per
relay can serve sequential explicit subscriptions without making research
operations themselves parallel or automatic. It is especially relevant to
NIP-42 authentication.

### Priority 4: add explicit remote search and scope estimation

Two relay operations would complement, not replace, existing acquisition:

#### NIP-50 relay search

- accept the NIP-50 `search` string only in a clearly remote search operation;
- prefer relays that advertise NIP-50;
- retain which relay produced every result;
- expose that relevance ordering and spam filtering are relay-specific;
- do not merge it conceptually with deterministic local `scan`; and
- allow several supporting relays because their indexes and policies differ.

This can help seed research from names, topics, and harder-to-bind concepts
without pretending the results are complete or neutral.

#### NIP-45 count

- count a filter on selected relays before fetching a large window;
- report every relay separately;
- indicate exact versus approximate results when supplied by the relay; and
- use the result as planning evidence, not a global Nostr count.

This directly helps choose bounds and avoid expensive or unproductive
acquisition.

### Priority 5: expose status claims without enforcing policy

Interpret:

- NIP-09 deletion requests;
- NIP-40 expiration;
- NIP-62 vanish requests;
- NIP-36 content warnings;
- NIP-32 labels;
- NIP-56 reports; and
- NIP-85 trusted assertions.

The research-safe behavior is:

- preserve canonical evidence;
- validate relationships such as same-author deletion authority where the NIP
  requires it;
- show the claim, issuer, target, time, and reason;
- offer explicit filters or derived status; and
- let the researcher choose sources and policy.

Reports, labels, and assertions are subjective and can be gamed. They are
useful evidence only when attribution remains visible.

### Priority 6: use curated protocol structures for discovery

Selected NIP-51 public lists can substantially improve the main product goal:
finding interesting people and coherent groups.

High-value list types include:

- follow sets;
- interest sets;
- starter packs;
- curation sets;
- bookmarks;
- search-relay lists;
- relay sets;
- mute lists; and
- blocked-relay lists.

These should become typed list membership relationships with visible list
author and event provenance. They should not automatically modify the
researcher's notebook, relay configuration, or moderation state.

Encrypted private-list handling requires keys and is not part of this step.

### Priority 7: verify selected identity claims

NIP-05 and NIP-39 checks can help a researcher judge whether a profile connects
to a domain or external identity.

They should be explicit external operations that return:

- the original claim;
- where and when it was checked;
- resolved, missing, mismatch, or error status;
- returned relay hints where applicable; and
- enough evidence to reproduce the conclusion.

Verification is not universal credibility. A valid NIP-05 identifier or
external proof establishes control of another identifier, not the quality of
the account.

## Useful later, but not first

### Rich content projections

Structured long-form, media, picture, video, and file metadata would improve
inspection and a future UI. They are not currently blocking generic research
because raw tags and content can already be scanned and projected.

Add these when a real consumer needs predictable fields, rather than creating
one parser for every content NIP in advance.

### NIP-66 relay observations

Relay-monitor events could help discover relays and compare advertised facts
with third-party probes. They should be represented as attributed monitor
claims. Automatically converting them to quality or safety scores would hide
the monitor selection, measurement window, and policy.

### NIP-13 proof of work

Computed PoW difficulty can be useful as one spam-related feature. It is not a
general quality signal and should remain a derived observable value.

### NIP-89 application handlers

Handler discovery could help explain unknown event kinds or open them in
specialized applications. It is not necessary to retain, scan, and inspect
those events in the research engine.

### NIP-77 negentropy

Negentropy is attractive for efficient synchronization or maintaining a
replica. The current product performs bounded exploratory acquisition, not
relay synchronization. It becomes relevant only if repeated research requires
keeping a large local slice synchronized.

## Deliberately outside the current product

The following should not be implemented merely for broader Nostr compliance:

- publishing and event signing;
- direct or group messaging;
- wallets, payments, zaps, and commerce;
- automatic following, blocking, reporting, or moderation;
- private-list decryption;
- relay administration;
- automatic relay fallback or scoring;
- a complete offline Nostr replica;
- protocol-specific application execution; and
- a universal interpretation framework for every registered event kind.

Some of these could become separate products. They do not improve the current
research vessel enough to justify their security and complexity costs.

## Recommended protocol work sequence

This is a dependency order, not a commitment to implement all items.

### Pass A: relationship correctness — completed 2026-07-28

- introduce explicit kind-aware relationship interpretation;
- correctly type NIP-10, NIP-22, repost, reaction, and deletion targets;
- retain generic raw-tag visibility;
- verify existing conversation and continuation behavior against the corrected
  relationships.

The completed pass gives relationship interpretation one owner, keeps
conversations limited to thread edges, exposes typed repost/reaction/deletion
targets, and preserves generic mechanical references.

### Pass B: reference completeness

- introduce addressable-event identity;
- decode NIP-19 and NIP-21 values;
- extract NIP-27 inline references;
- support local and explicit relay navigation for event, account, address, and
  optionally external subjects;
- surface relay and author hints without automatically trusting them.

Success means that a visible protocol reference can be inspected or used to
form an explicit acquisition step.

### Pass C: relay visibility and specialized requests

- add explicit NIP-11 inspection as an attributed, ephemeral
  relay-information report rather than notebook knowledge or hidden
  acquisition work;
- preserve NIP-11 retrieval errors, malformed responses, omissions, and
  advertised limitations as carefully as successful document content;
- parse bounded `NOTICE` messages, standardized `CLOSED` reason prefixes, and
  NIP-67 hints;
- distinguish failure before opening, peer closure before completion, explicit
  refusal, and ordinary request bounds;
- observe `AUTH` challenges without inferring that a read request failed or
  introducing a signer;
- expose every new transport fact through acquisition reports, session
  handles, bounded presentation, and factual schema;
- add explicit NIP-45 count as per-relay planning evidence, preserving exact
  and approximate metadata and never aggregating overlapping relay counts into
  a global total;
- defer explicit NIP-50 search until a search-capable relay is part of regular
  trials;
- let sustained trials decide whether connection reuse or bounded retry earns
  implementation;
- consider NIP-42 only when a signer/security boundary is deliberately chosen.

Success means that the researcher can understand relay capability,
limitations, partiality, and request failure before resorting to guesswork.

### Pass D: attributed research context

- typed NIP-51 public lists;
- deletion, expiration, and warning status;
- attributed labels, reports, and assertions;
- explicit NIP-05 and selected NIP-39 verification.

Success means that protocol-native curation and claims enrich research without
becoming hidden trust policy.

### Pass E: consumer-driven projections

- rich profile fields;
- long-form metadata;
- structured media and file metadata;
- NIP-66 relay-monitor evidence if sustained relay research needs it.

Only implement projections that remove repeated friction in actual sessions.

## Design guardrails

Protocol work should preserve the project's existing strengths:

1. **Raw events remain immutable evidence.** Interpretation creates derived
   facts and status.
2. **Local query and network acquisition stay separate.** NIP-50 must not turn
   a local scan into a hidden relay request.
3. **Every external claim remains attributed.** NIP-11 capability, NIP-65
   relay preference, NIP-32 label, NIP-56 report, NIP-66 probe, and NIP-85
   assertion are evidence from an issuer.
4. **Advertised and observed behavior remain distinct.** A relay document can
   say it supports a NIP while a real request fails.
5. **Address coordinates are not event IDs.** Current-version resolution must
   remain explicit.
6. **Relay hints do not silently change configuration.** They are candidate
   sources for an explicit action.
7. **Partiality remains machine-readable.** EOSE, timeouts, limits, NIP-67
   hints, and approximate counts should not be compressed into a single
   success flag.
8. **Per-relay counts remain per-relay.** Relay corpora overlap, so NIP-45
   results are attributed planning evidence and must not be summed into an
   unexplained global count.
9. **No automatic trust score.** Graph distance, labels, reports, identity
   proofs, PoW, relay choice, and activity are features for researcher
   judgment.
10. **Prefer small interpreters over a NIP framework.** Add semantics only when
   they improve real navigation or correct existing behavior.
11. **Keep sequential research composable.** Better relay support must not
    reintroduce hidden multi-step workflows.

## Final assessment

The project does not need broader indiscriminate Nostr support. It needs a
more accurate bridge between canonical evidence and the identities,
relationships, and relay behavior a researcher can act on.

The present core is already suitable for:

- bounded public-relay acquisition;
- local event and text filtering;
- author/profile/follow exploration;
- ordinary note-thread navigation;
- generic tag and content investigation;
- provenance-aware comparison; and
- iterative manual research.

It is not yet reliable enough for:

- navigating addressable or inline protocol references;
- understanding why relays support, reject, truncate, or authenticate
  requests;
- using relay-native search or count facilities;
- consuming protocol-native lists as discovery structures; or
- evaluating deletion, expiration, identity, moderation, and assertion claims
  as structured attributed evidence.

Correcting those boundaries would make the system substantially more useful
without specializing it into one research workflow or turning it into a
conventional Nostr client.

## Primary sources

All protocol references below are official Nostr NIPs:

- [NIPs index and implementation warning](https://github.com/nostr-protocol/nips)
- [NIP-01: basic protocol flow](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-02: follow list](https://github.com/nostr-protocol/nips/blob/master/02.md)
- [NIP-05: DNS identifiers](https://github.com/nostr-protocol/nips/blob/master/05.md)
- [NIP-09: deletion requests](https://github.com/nostr-protocol/nips/blob/master/09.md)
- [NIP-10: text-note references](https://github.com/nostr-protocol/nips/blob/master/10.md)
- [NIP-11: relay information](https://github.com/nostr-protocol/nips/blob/master/11.md)
- [NIP-13: proof of work](https://github.com/nostr-protocol/nips/blob/master/13.md)
- [NIP-18: reposts](https://github.com/nostr-protocol/nips/blob/master/18.md)
- [NIP-19: encoded entities](https://github.com/nostr-protocol/nips/blob/master/19.md)
- [NIP-21: `nostr:` URI scheme](https://github.com/nostr-protocol/nips/blob/master/21.md)
- [NIP-22: comments](https://github.com/nostr-protocol/nips/blob/master/22.md)
- [NIP-23: long-form content](https://github.com/nostr-protocol/nips/blob/master/23.md)
- [NIP-24: extra metadata fields and tags](https://github.com/nostr-protocol/nips/blob/master/24.md)
- [NIP-25: reactions](https://github.com/nostr-protocol/nips/blob/master/25.md)
- [NIP-27: text references](https://github.com/nostr-protocol/nips/blob/master/27.md)
- [NIP-32: labeling](https://github.com/nostr-protocol/nips/blob/master/32.md)
- [NIP-36: sensitive content](https://github.com/nostr-protocol/nips/blob/master/36.md)
- [NIP-39: external identities](https://github.com/nostr-protocol/nips/blob/master/39.md)
- [NIP-40: expiration](https://github.com/nostr-protocol/nips/blob/master/40.md)
- [NIP-42: relay authentication](https://github.com/nostr-protocol/nips/blob/master/42.md)
- [NIP-45: event counts](https://github.com/nostr-protocol/nips/blob/master/45.md)
- [NIP-50: relay search](https://github.com/nostr-protocol/nips/blob/master/50.md)
- [NIP-51: lists](https://github.com/nostr-protocol/nips/blob/master/51.md)
- [NIP-56: reporting](https://github.com/nostr-protocol/nips/blob/master/56.md)
- [NIP-62: request to vanish](https://github.com/nostr-protocol/nips/blob/master/62.md)
- [NIP-65: relay list metadata](https://github.com/nostr-protocol/nips/blob/master/65.md)
- [NIP-66: relay discovery and liveness](https://github.com/nostr-protocol/nips/blob/master/66.md)
- [NIP-67: EOSE completion hints](https://github.com/nostr-protocol/nips/blob/master/67.md)
- [NIP-68: picture events](https://github.com/nostr-protocol/nips/blob/master/68.md)
- [NIP-70: protected events](https://github.com/nostr-protocol/nips/blob/master/70.md)
- [NIP-71: video events](https://github.com/nostr-protocol/nips/blob/master/71.md)
- [NIP-73: external content IDs](https://github.com/nostr-protocol/nips/blob/master/73.md)
- [NIP-77: negentropy synchronization](https://github.com/nostr-protocol/nips/blob/master/77.md)
- [NIP-85: trusted assertions](https://github.com/nostr-protocol/nips/blob/master/85.md)
- [NIP-92: media attachments](https://github.com/nostr-protocol/nips/blob/master/92.md)
- [NIP-94: file metadata](https://github.com/nostr-protocol/nips/blob/master/94.md)

Live NIP-11 documents checked:

- `https://nos.lol`
- `https://relay.primal.net`
- `https://relay.damus.io`
