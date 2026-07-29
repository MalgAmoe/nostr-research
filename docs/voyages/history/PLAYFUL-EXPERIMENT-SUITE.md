# Playful experiment suite

Date: 2026-07-29

This suite tested six deliberately odd research briefs against live public
relays. The purpose was not to prove their stories, but to see what the
existing engine could actually evidence when the navigator followed each
premise.

Relays used where applicable:

- `wss://nos.lol/`
- `wss://relay.primal.net/`
- `wss://relay.snort.social/`

All results are bounded observations. Relay absence is never treated as global
Nostr absence.

## 1. Relay Confessional

The same kind-1 filter and one-hour time range were acquired separately from
each relay, with a 200-event distinct-event bound.

- Nos returned 200 events and hit the bound.
- Primal returned 200 events and hit the bound.
- Snort opened, subscribed, reached EOSE, and returned zero events.
- Nos and Primal shared 52 events in their bounded results.
- Each retained 148 events absent from the other's bounded result.
- The Nos-only side contained 128 authors; the Primal-only side contained 76.
- The observed time ranges also differed: Primal's bounded page was concentrated
  closer to the end of the requested hour.

This demonstrates that where a vessel docks materially changes the bounded
field it receives. It does **not** prove that the 148 side-specific events were
absent from the other relay's storage: result ordering, timing, and the
200-event limit can create different windows.

Verdict: a useful relay-comparison instrument. Its artifact must retain the
request and bounds beside every difference.

## 2. Dowsing for Humans

A 500-event field without a kind filter contained 61 event kinds from 246
authors. Rather than choosing the numerically largest kind, the navigator
selected a rare kind that looked structurally unfamiliar: kind 445.

The event:

- had base64 content;
- carried an `h` hash tag and `encoding=base64`;
- was observed on Nos and Primal;
- had no resolvable profile or other bounded history for its author in the
  follow-up query.

The engine exposed a real, signed, attributed protocol object but could not
infer its application semantics. That unresolved state was the correct result.

Verdict: rarity is a productive entrance when the navigator chooses a
meaningful dimension. It produces questions, not automatic explanations.

## 3. Mirror Test

The broad field was grouped by exact event text and distinct author. This
first exposed many same-author machine states; requiring cross-author
repetition revealed a stranger case.

Two different pubkeys emitted kind-37195 events with:

- identical structured content;
- identical `created_at`;
- the same `d`, protocol, version, and expiration tags;
- different event IDs and signatures.

The payload advertised a `fips-overlay-v1` endpoint and signal relays. A
bounded history query found only the two advertisements and no profiles.

The evidence supports two protocol nodes emitting synchronized replaceable
advertisements. It does not establish whether they are one operator, one
software fleet, or independent nodes following the same schedule.

Verdict: exact cross-author repetition is an excellent entrance into
machine-to-machine Nostr. The test should not be framed only as bot detection
or copied human speech.

## 4. Zap Archaeology

A bounded kind-9735 acquisition returned 179 distinct zap receipts from 36
receipt authors before the 350-observation budget was reached.

The inspected receipts included:

- an ordinary event zap with recipient `p`, sender `P`, referenced event `e`,
  `bolt11`, and a serialized kind-9734 request;
- a Fountain podcast payment using podcast item and podcast GUID `i` tags;
- explicit requested amounts inside the serialized zap request.

This is visibly a different topology from follows and mentions: value moves
to event authors, podcast recipients, and application-defined resources.
However, a reliable payment graph requires careful role normalization and
Lightning amount handling. Relay-visible receipts are also not a complete
ledger.

Verdict: a strong protocol-specific research instrument and a promising
playful entrance. The current generic tag algebra can inspect it, but a serious
value-flow study needs a separately justified normalization boundary.

## 5. Reply Guys: a bounded census

A random 300-note field was related and grouped by author and conversation
role. One reply-heavy candidate was then queried separately to avoid a
prolific account consuming the combined author budget.

For that account:

- the latest 100 observed kind-1 events were all classified as replies;
- relay continuation for replies to those 100 events completed across all
  three relays;
- 99 inputs had an empty valid result and one input matched;
- the result contained one received reply.

The mechanical pattern is therefore observable: a bounded authored history
can be reply-only while receiving almost no replies to the sampled events.
The engine cannot conclude that the person is annoying, ignored, human, or
mistaken about their social role.

Verdict: useful as a behavioral-shape instrument. The original insulting story
must remain outside the vessel.

## 6. The Séance

The initial premise was to find an old-looking profile, establish inactivity,
and reconstruct its final week.

The first sampled old profile was not abandoned: a follow-up query returned 11
later notes, including recent replies. This immediately disproved the inference
from old metadata.

A second profile had:

- an old metadata event;
- zero kind-1 notes after the chosen recent cutoff;
- zero kind-1 notes in an unbounded-time, bounded-count follow-up across all
  three relays.

The candidate therefore had no reconstructable “last words” in the observed
relay field. Zero recent notes did not distinguish abandonment from missing
history, relay placement, deletion, migration, or a profile that never posted.

Verdict: inconclusive by design. A viable Séance entrance must begin with
known historical activity and only then test for a later stopping point.
Starting from an old profile reverses the evidence dependency.

## Cross-experiment conclusions

These briefs are not six new vessels.

They exposed reusable instruments:

- per-relay bounded comparison;
- rarity over a navigator-chosen dimension;
- cross-author exact-repetition analysis;
- protocol-specific tag topology;
- authored-versus-received conversation shape;
- historical-presence and later-absence checks.

They also exposed recurring discipline:

- chance or oddity can choose an entrance, but evidence must test its story;
- a missing relay result cannot carry the narrative placed upon it;
- bounds and ordering belong in the artifact, not in footnotes;
- machine traffic is often the interesting object, not merely noise;
- a playful name is useful as a prompt, but dangerous as a conclusion.

The most productive experiments were the ones that let their initial story
collapse. Mirror Test became protocol-node archaeology. Dowsing ended in an
honestly unresolved object. Séance demonstrated that its own boarding rule was
invalid. Reply Guys found the proposed shape while refusing the proposed
judgment.

No missing generic engine operation was demonstrated. The friction was in
choosing and stating honest entrance conditions, which belongs in voyage
briefs and navigator practice.
