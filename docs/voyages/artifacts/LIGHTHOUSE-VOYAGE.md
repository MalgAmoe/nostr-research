# Lighthouse voyage 1

Date: 2026-07-29

Status: bounded in-session temporal voyage completed.

## Posture

The Lighthouse attends to change between explicit bounded observations. It does
not claim to observe the complete state of Nostr and does not equate “absent
from the second attempt” with deletion.

Its senses are:

- overlap between two named acquisition handles;
- subjects present only in the later attempt;
- subjects present only in the earlier attempt;
- declared event-time ranges; and
- the acquisition bounds and relay outcomes that condition every difference.

Its collection is a bounded change log. The navigator decides which changes
deserve inspection.

## Procedure

The session used:

- `wss://nos.lol/`
- `wss://relay.primal.net/`
- `wss://relay.snort.social/`

Two acquisitions used the same kind-1 filter and the same operation-wide
bounds. Each returned 300 distinct events and stopped at the configured
distinct-event budget. The filter's relay-local limit was 250; the
operation-wide distinct-event budget was 300, so the combined multi-relay
result could reach 300.

The first timestamp marker was recorded immediately before the first
acquisition. After that acquisition completed, the navigator waited twenty
seconds before starting the second. The full marker-to-second-start interval
was 57 seconds because it also included the first external acquisition.

All set operations were local and composed through focused schema:

- `snapshot2 - snapshot1`
- `snapshot1 - snapshot2`
- `snapshot2 ∩ snapshot1`

## Change log

Each snapshot contained 300 events:

- stable overlap: 268 events, from 162 distinct authors;
- present only in snapshot two: 32 events, from 23 authors;
- present only in snapshot one: 32 events, from 21 authors.

The overlap was therefore 89.3% of either bounded snapshot.

The second-only set declared event timestamps from `1785346355` through
`1785346418`. Relative to the first marker:

- 31 events declared timestamps at or after the marker;
- one event declared a timestamp seven seconds before the marker.

The earlier-only set ranged from `1785345673` through `1785346232`. Its older
range is consistent with a moving recent-event window, but the evidence does
not prove why each event disappeared from the second bounded attempt.

Representative second-only material included ordinary replies and discussion,
news posts, images, application presence data, a maintenance notice, the
previously observed repeated freelance solicitation, and a high-volume
semantic-search publisher. The change log therefore reflects the same mixed
Nostr field rather than a specially curated temporal feed.

## Bounds and operation

- Final corpus: 332 distinct resident events, 33.2% pressure.
- Stored observations: 759, including repeated observations of overlapping
  events.
- Live handles: eight.
- Archive and notebook: empty.
- Protocol command failures: zero.
- All nontrivial local commands used focused schema and the composer.

## Finding

The Lighthouse is viable without persistence as an in-session vessel. It can
answer:

> What differed between these two explicit bounded observations?

It cannot honestly answer:

> What was newly published everywhere on Nostr?

Identity difference and declared event time are complementary senses. In this
voyage, 31 of 32 later-only events were time-consistent with arrival after the
first marker, while one exposed that bounded relay observation and event time
are not identical.

The vessel therefore needs no new engine operation. Its useful convention is
to retain both the raw set delta and a timestamp-relative projection, while
keeping acquisition bounds visible. Cross-session Lighthouse voyages remain
parked until an explicit export/import or persistence boundary exists.
