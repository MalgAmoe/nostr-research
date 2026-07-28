# M6 sustained research trials

Date: 2026-07-28

These trials used one persistent declarative JSONL session. No custom
JavaScript analysis was written. The session used:

- `wss://nos.lol/`
- `wss://relay.primal.net/`
- `wss://relay.snort.social/`
- a 1,000-event observation buffer;
- 300 observations and 250 distinct events per ordinary acquisition; and
- bounded presentation through `show`.

The purpose was to evaluate the research environment, not to establish global
facts about Nostr or endorse the profiles encountered.

## Trial 1: directed moderation and spam-resistance research

### Question

Who appears to be doing concrete work on relay moderation, spam resistance,
and safer Nostr feeds?

### Path

1. Counted kind-1 notes from the preceding seven days before acquisition.
2. Acquired a 250-event orientation window from three relays.
3. Searched the resident corpus independently for `spam`, `moderation`,
   `relay`, `filter`, `safety`, `mute`, and `trust`.
4. Marked a repeated machine `zone_presence` source as irrelevant to this
   question rather than encoding a system-wide classifier.
5. Moved the evidence window backward and repeated the searches.
6. Moved candidate notes to their authors and hydrated profiles.
7. Followed the Amethyst project account into 100 authored notes.
8. Scanned its notes for moderation vocabulary.
9. Followed referenced accounts, hydrated their profiles, and acquired a
   bounded set of their authored notes.
10. Preserved relevant excerpts and recorded Amethyst as a notebook anchor.

### Result

The strongest evidence-backed anchor was the Amethyst project account,
`aa9047325603dacd4f8142093567973566de3b1e20a89557b728c3be4c6a844b`.

Its own notes described implemented or announced mechanisms including:

- a hashtag-spam filter;
- security filters and hidden-word controls;
- Web-of-Trust/GrapeRank support;
- blocked and trusted relay behavior;
- NIP-32 labeling;
- NIP-86 relay management;
- relay monitoring and membership information; and
- moderation in supported group/community protocols.

The graph exposed Vitor Pamplona and several Amethyst contributors or
developers, but the bounded evidence was not sufficient to classify six to ten
individual people as specifically working on moderation. The honest result is
one strong project anchor plus a candidate contributor graph, not a completed
people directory.

### What the system contributed

- Count-before-fetch showed the scale mismatch: `nos.lol` reported 10,000
  matching events, while the other two relays returned attributed `NOTICE`
  outcomes for the unsupported command.
- Acquisition exposed its exact budgets and partiality.
- Local search quickly separated zero-result terms from populated ones.
- Identity movement, profile hydration, authored-note continuation, relation
  scanning, preservation, and notebook judgment composed without custom code.
- The system retained the distinction between project evidence, account
  identity, relay observation, and researcher judgment.

### Research limitations, not library defects

- A random recent buffer contained substantial machine traffic.
- Ordinary relay filters cannot search event content, so topic discovery
  requires sampling windows or starting from an account/tag/reference.
- Keyword matches were frequently incidental.
- Relay count advertisements and observed behavior cannot guarantee that a
  relay's reported count is globally meaningful or uncapped.

## Trial 2: open-ended community discovery

### Question

Starting from a fresh 242-note window, could an unchosen coherent community of
at least six profiles be discovered?

### Path

1. Acquired the next older window, filling the observation buffer and causing
   the first 26 evictions.
2. Scanned broad words including music, science, privacy, art, history,
   photography, gardening, books, language, software, food, and health.
3. Rejected obvious automated matches such as repeated block-art and
   cross-posting bots by researcher judgment.
4. Followed a note saying “Design, Art, Photos, Videos all in Nostr” to its
   referenced event.
5. Explicitly acquired that unresolved reference.
6. The reference resolved to an original maker post from MadMunky2140 about
   woodwork, craft, butterfly photography, video, and art.
7. Hydrated the author, acquired 60 authored notes, moved to 42 referenced
   accounts, and hydrated their profiles.
8. Scanned profile descriptions for concrete creative vocabulary.
9. Selected seven profiles with specific art, music, design, or maker
   descriptions and recorded them as a provisional membership.

### Provisional group

- MadMunky2140 — maker, photography, music and original media;
- Laan Tungir — artist and scientist;
- Bitcoin Summer Burn — physical mixtape/CD exchange and artwork;
- Aaron Koenig — films, books and music;
- Haleen — musician and producer;
- Fzero — designer and illustrator; and
- Franchovy — developer and tutorial maker.

These profiles are connected through MadMunky's recent referenced-account
graph and supported by profile evidence. This is a successful discovery path,
not proof that every account is active, authentic, mutually connected, or
worth following. Authored-note verification remains deliberately recorded as
unfinished.

## Memory and continuity result

The session ended with:

- 1,000 resident events;
- 132 buffer evictions;
- 7 excerpt archive entries;
- 20 notebook entries;
- 2 named memberships; and
- 47 result handles.

After turnover, the moderation anchor was recoverable from the notebook with
its judgment, labels, reason, attribution, membership, and current profile.
The preserved excerpt query returned seven archived subjects, including two
whose canonical evidence was no longer resident. This demonstrates that
notebook identity and deliberate evidence preservation survive renewable
buffer turnover.

## Library strengths observed

1. The declarative operations were sufficient for both directed and emergent
   navigation without dynamic JavaScript.
2. External attempts exposed attribution, bounds, duplicates, and partiality.
3. Collections handled identity movement while relations handled mechanical
   scanning.
4. Unresolved references could be made explicit and then acquired.
5. Notebook knowledge and preserved excerpts remained distinct from renewable
   observations.
6. Bounded presentation prevented the session from dumping complete corpora by
   default.
7. Researcher interpretation remained outside the engine.

## Concrete interface and correctness friction

### 1. `list` parameter errors can become `INTERNAL_ERROR`

`list` works with no parameters. Supplying `offset` and `limit` returned:

```text
INTERNAL_ERROR: The command could not be completed.
```

The session schema advertises `limit` and `sizeLimit`, not `offset`. An unknown
parameter should be rejected as `INVALID_COMMAND` with a useful message rather
than escaping through presentation as an internal error.

### 2. Handle lifecycle becomes noisy during sustained work

The session accumulated 47 handles. Explicit `release` exists, so this is not
a missing capability, but sustained research makes it easy to retain many
temporary search and observation handles. Before adding automatic lifecycle
policy, another trial should determine whether concise multi-release or better
list visibility is enough.

### 3. Hydration cardinality is understandable only with close attention

Hydrating 42 account subjects returned a handle containing 46 metadata events
while reporting all 42 accounts resolved. Multiple valid historical kind-0
events can therefore make the event-handle count differ from the requested
account count. The evidence is honest, but the common research question is
usually “which accounts resolved?” A bounded account-oriented observation of
hydration would be easier to reason about than relying on acquisition event
cardinality.

### 4. Archive summary vocabulary can be misread

An `archived` query returned seven excerpt entries, while its collection
summary reported evidence resolution as five buffer, zero archive, and two
unresolved. This is internally defensible because an excerpt is not canonical
evidence resolution, but a researcher can reasonably read “archive: 0” as
claiming that no archive material exists. Presentation should distinguish
archived-entry presence from canonical subject resolution.

### 5. Interface discovery remains uneven

Invalid notebook judgment vocabulary and excessive preview limits produced
good, specific errors. In contrast, global `schema` does not accept an
operation selector; focused operation schema requires a compatible input
handle. This is consistent with the removal of prescriptive next operations,
but a caller still has to know when global facts versus contextual operation
facts are available.

## Recommended next work

Do not add multi-filter acquisition, NIP-51, authentication, retry policy, or
new research heuristics based on these two trials.

First fix the confirmed `list` error classification. Then investigate, without
immediately redesigning:

1. whether hydration presentation can expose requested/resolved accounts more
   directly;
2. whether archive summaries can name excerpt presence without implying
   canonical resolution; and
3. whether sustained handle cleanup needs one small convenience or merely
   better usage discipline.

After those checks, repeat one sustained trial before promoting a larger
protocol feature.

## Post-fix verification trial

Date: 2026-07-28

A second persistent session tested the corrected cardinality presentation and
a wider cross-section of the public interface. It used the same three relays,
a 400-event buffer, a 40-entry archive, and a 60-entry notebook.

### Boundaries exercised

- JSONL session configuration, schema, status, revisions, and lifecycle;
- browser Worker initialization, deterministic acquisition, relay count,
  relation transition, bounded preview, and close;
- NIP-11 relay information and NIP-45 relay-local count;
- bounded live acquisition and all acquisition observation modes;
- local text selection, collection movement, set comparison and union;
- profile hydration and account-field relation scanning;
- relation aggregation, sorting, slicing, extraction, and hydration;
- declarative multi-stage plans;
- notebook judgments and named membership;
- excerpt preservation, archive query, and buffer turnover;
- local and relay-backed continuation;
- stale-revision rejection and explicit handle release.

The browser smoke test passed outside the macOS process sandbox. The sandboxed
failure was Chromium's denied Mach-port registration, not an application
failure.

### Corrected behavior confirmed with live data

Hydrating 14 account subjects acquired 15 immutable metadata events. The
response reported:

- `requested: 14`;
- `resolved: 14`;
- `units: "accounts"`;
- `acquiredMetadataEvents: 15`; and
- one account with multiple metadata events.

The handle still honestly counted 15 event records.

Twenty-four excerpt entries were then preserved. After a 300-event acquisition
filled the 400-event buffer and caused 55 evictions, the archive summary
reported:

- 24 archive entries, all at excerpt level; and
- canonical evidence resolution of 16 buffer, zero archive, and eight
  unresolved.

This is the intended distinction: all excerpts remain deliberately preserved,
while only complete resident or canonical archive evidence resolves a subject.
The `list` unknown-parameter path also returned the intended
`INVALID_COMMAND` with `Unknown list parameter: offset.`

### Further findings

These four findings were corrected after the trial. The descriptions below
preserve the observed failures and their causes as validation history.

#### 1. Continuation handles do not compose symmetrically in set operations

Local and relay-backed `authored-notes` continuations returned ordinary
event-kind handles with 14 and 30 members. Contextual schema advertised
`compare` for the local continuation and explicitly requested another events
handle. Comparing the two nevertheless failed with:

```text
INVALID_OPERATION: Expected a result collection.
```

The input continuation is resolved through `memory.asCollection`, but the
continuation supplied as the set operation's `with` value remains wrapped in
its outer report. This is an execution inconsistency with the factual schema,
not a limitation of relay data.

#### 2. Exact membership inspection bypasses bounded presentation

Querying one five-member named membership returned its complete accumulated
reason graphs directly. Even a small membership produced a very large JSON
response. `membership` currently exposes the raw memory accessor rather than a
bounded observation with offsets, omissions, and size enforcement.

Membership identity and reasons are important and should remain available.
The problem is the unbounded default response, not the stored data.

#### 3. Text-array conjunction is not discoverable enough

`select` with `text: ["music", "musician", "album", "song"]` returned no
matches because every supplied term is required. Independent one-term searches
behaved correctly. Conjunctive semantics are defensible, but contextual schema
currently says only “text term or term array” and does not state that an array
means AND.

#### 4. Unknown sort parameters use misleading vocabulary

Supplying `limit` directly to `sort` correctly failed because bounding belongs
in a following `slice`, but the error was:

```text
Unknown sort field: limit.
```

`limit` was an unknown operation parameter, not a relation field. The schema
made the valid composition discoverable; only the error label is misleading.

### Behaviors that remained coherent

- Relay information succeeded for all three relays.
- Relay count remained per-relay and partial when two relays returned NOTICE.
- Acquisition exposed duplicates, per-relay outcomes, and global bounds.
- Profile hydration distinguished unresolved accounts from successful relay
  completion.
- Account relation schema accurately exposed populated fields and lineage.
- `scan` with explicit fields and match modes remained mechanical.
- Aggregate → sort → slice → extract → hydrate composed successfully after
  following contextual schema.
- Plans and individual commands used the same operation semantics.
- A stale mutating command left revision and state unchanged.
- Notebook knowledge, membership, and archived excerpts survived buffer
  turnover.
- Explicit releases reduced handle count without affecting notebook or archive
  state.
