# Dowsing Rod voyage 1

Date: 2026-07-29

Status: bounded rarity voyage completed; collection remained caller-side.

## Posture

The Dowsing Rod foregrounds low-frequency properties without treating rarity
as value. It asks which formats, media families, domains, tags, authors, or
relationship shapes occur least often in a bounded random field. The navigator
chooses whether any rare pocket deserves inspection.

The vessel does not prescribe an `uncertain` judgment and does not classify a
rare event as interesting. Its intended collection is a small set of
curiosities with the exact property that made each visible.

## Field

A fresh kind-1 acquisition returned 450 distinct events from:

- `wss://nos.lol/`
- `wss://relay.primal.net/`
- `wss://relay.snort.social/`

The field contained 247 authors and was bounded by the distinct-event budget.
The schema-backed composer was used for all relation construction.

## Unhelpful rarity dimensions

`event.format` did not divide this field at all: every event was reported as
`plain-text`. This is mechanically correct because kind-1 event bodies remain
text even when they contain media references. It is not a useful dowsing
dimension for this field.

The `unknown` media family occurred in ten events from nine authors. Inspection
showed ordinary image and article-share posts whose media could not be
classified through the normalized attachment facts available to this view.
“Unknown” describes incomplete typing, not unusual content. The navigator did
not retain this pocket as a curiosity collection.

## Useful rarity dimension: video

Only four of the 450 events had the `video` media family, each from a distinct
author:

1. `4a510e879de04b320393d5b31522306995989dbd450b598506a2cc6aba123cc7`
   — a bare Primal-hosted MP4.
2. `df537a19f7492ebf833da6e2c195db7b6c3cb3cc86528e2d808abc9e97e4f17e`
   — “So epic the way he makes #music with the crowd,” authored by the
   currently resolved profile `ButtercupRoberts`.
3. `78a36a9556539b48a85abafdff8f2952ff31115e89c6ccdae7afcd5ea8ddf490`
   — “Easier to find objects in the sky!”, authored by the currently resolved
   profile `Karnage`.
4. `222bc471af3bc17208d58833b3e824013bbc1a11a94433d849b6ecab2951a343`
   — a bare Primal-hosted MP4 in a referenced conversation, authored by the
   currently resolved profile `Ghengis Steve`.

The fourth author's hydration produced several immutable metadata events, so
the profile result contained eleven events for four resolved accounts. This
did not change the four-account subject completeness.

These four notes became the caller-side curiosity set. Rarity led to a mixed
collection—music, sky observation, and two opaque media posts—rather than a
coherent topic. That is acceptable: the collection records what the vessel
made visible, while the navigator still decides what deserves another voyage.

## Bounds and operation

- Final observed buffer before collection: 461 of 900 events, 51.2% pressure.
- Live handles: thirteen.
- Protocol command failures: zero.
- One preservation draft was rejected by the composer before execution because
  the navigator supplied a string where the contract required a structured
  reason object.
- Archive and notebook remained empty.

The rejected draft is not an engine error. The composer prevented an invalid
command without inventing the missing evidence structure. Because the session
then ended, the curiosity set survives in this document rather than in the
process-local archive.

## Finding

Rarity is useful only after choosing a property whose cardinality can carry
meaning. “Rare format” was empty as a distinction; “unknown media” mostly
measured incomplete classification; “video” produced a small inspectable
pocket.

The Dowsing Rod therefore works less as a fixed ranking and more as a sensory
sequence:

1. expose the cardinality of several factual dimensions;
2. discard dimensions that do not divide the field meaningfully;
3. inspect one bounded rare pocket; and
4. let the navigator decide whether it becomes cargo.

No new engine operation follows from this. The next version of the card should
make “inspect dimension cardinality before selecting a rare pocket” explicit.
