# Three creatures round

This round deliberately tested three incompatible arrangements over the same
neutral controller. They are not versions of one composer and no winner was
expected.

## Airlock

**Sensors:** Home, Questions, Weather.  
**Executor:** staged routes advanced one visible command at a time.

Airlock protected an explicitly adopted 220-event Home while opening a
five-event entrance sample. Its first Weather was too weak: count and
boundedness did not describe the surrounding field. Weather was updated to
surface existing event facts. On the corrected flight it reported 90 distinct
authors while kind 22668 accounted for 103 of 220 events.

The entrance sample was dominated by machine signaling. This was useful:
Airlock made the poor neighborhood legible without silently replacing Home or
choosing an escape. Its weakness is the same as its character. Deliberation
can protect the navigator from accidental movement, but cannot make a bad
field interesting.

## Pinball

**Sensors:** Table, Curiosities, Momentum.  
**Executor:** one command per Flipper hit; a successful handle moves the Ball.

Pinball retained a protected 280-event Table while the Ball moved through
event rows, kind aggregation, sorted kind gravity, and finally a selected odd
kind. The mixed field contained roughly fifty distinct kinds. Kind 22668 was
again dominant; ordinary kind 1 was minor.

After seeing the gravity table, the navigator chose rare kind 30382. The Ball
landed on three empty-content events from one author, posted seconds apart,
with an unknown engine role. That did not answer what kind 30382 means. It
created a concrete and unexpected next question.

Pinball produced the most playful behavior because it has almost no route
memory. Each response changes the immediate place from which the next hit is
chosen, while the Table remains safe. Its danger is shallow ricochet:
curiosities can accumulate without being settled.

## Darkroom

**Sensors:** Ground, Questions, Negatives.  
**Executor:** two visible commands developed as an A/B exposure.

Darkroom held one 260-row kind-1 Ground fixed and exposed it through
`event.hasMedia = true` and `false`. Across flights, media represented roughly
18% to 27% of the same-sized random field. The first contrast exposed repeated
illicit-product advertising on the media side. Later contrasts showed other
spam, machine presence packets, and violent or conspiratorial text distributed
differently across both sides.

The original `countDifference` was unnecessarily hard to read. Ground-relative
shares were added after the first flight. Darkroom became useful immediately:
it does not travel; it changes the framing while preserving the source.

Darkroom is the strongest of the three for questions of difference. It is a
poor general navigator because every movement has to be formulated as a pair.

## Conclusions

The experiment supports the user's claim that this layer admits infinite
variation. The same engine and controller supported three genuinely different
cognitive rhythms:

- Airlock asks, “What may leave this safe place?”
- Pinball asks, “What did that collision make interesting?”
- Darkroom asks, “What changes when the same ground is exposed two ways?”

Useful pieces do not need to be consolidated into one composer:

- protected safe context is valuable in both Airlock and Pinball;
- multiple live questions or curiosities are better than one fixed goal;
- event facts make a factual environmental sensor possible;
- one-step execution encourages reaction;
- paired execution makes contrast legible;
- bounded local memory should match the character: routes, collisions, or
  negatives are not interchangeable histories.

The main negative finding is equally useful: a universal composer made by
combining all three would erase their character and recreate the full engine
surface in a more complicated form. These experiments should stay disposable.

The reproducible live harness is
`experiments/three-creatures-live.mjs`. It uses three separate sessions and
prints bounded summaries; it is evidence tooling, not a product entry point.
