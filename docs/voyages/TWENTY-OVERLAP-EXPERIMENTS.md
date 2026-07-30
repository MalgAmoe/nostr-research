# Twenty overlap experiments

Date: 2026-07-30

## Purpose

These experiments did not ask whether a smaller API could replace the complete
research engine for an agent. They asked a different question:

> Which mixtures of location, evidence, movement, questioning, comparison,
> judgment and collection create a finite activity that a navigator could
> actually inhabit?

The unit under test was the overlap. A good overlap did not need to expose the
whole engine. It needed to make two or more capabilities more useful together
than they were separately.

## Method

Twenty mixtures were exercised over one shared live Nostr field. Reusing the
field made differences primarily consequences of the arrangements rather than
of unrelated relay samples.

The final field contained:

- 400 kind-1 events;
- 100 visible author groups;
- 91 authors with at most three visible notes;
- a deterministic sample of 30 quiet accounts;
- 39 referenced accounts;
- no intersection between those two account sets in the final run;
- no privacy matches and 100 music matches.

The absence of an intersection was useful evidence. An interface that only
feels meaningful when its preferred result is populated is fragile. An earlier
live pass over a different field produced four recognized accounts, three
resolved profiles and 80 authored notes, allowing the conditional descents to
be exercised as well.

All twenty final experiments executed successfully. The harness emitted 51
ordinary session commands, retained about 103 KB of transcript and omitted no
entries.

## Outcome scale

- **Strong seed** — creates a legible activity worth developing.
- **Useful ingredient** — valuable inside another arrangement, insufficient
  alone.
- **Situational** — useful for a particular research moment.
- **Weak** — mechanically valid but adds little for a navigator.
- **Dead end** — overlap makes the experience worse or duplicates context.

## Results

### 1. Ground + question + glimpse

**Overlap:** stable Home, one open question and eight bounded notes.

**Outcome:** Useful ingredient.

The question changed the meaning of the preview: the notes became possible
answers rather than an undirected feed. Home prevented the question from
silently changing its corpus. This is a good boarding arrangement, but it has
no mechanism for holding tensions or consequences.

### 2. Structure + voices

**Overlap:** field summary, author concentration, example texts.

**Outcome:** Strong seed for orientation.

This was the clearest answer to “where am I?” Structure alone was abstract and
voices alone were anecdotal. Together they made concentration visible while
retaining examples that could invalidate the numerical impression. The result
was larger than the smallest mixtures (about 6.8 KB), but the information was
complementary rather than duplicated.

### 3. Fixed ground + moving focus

**Overlap:** a pinned field summary beside an identity view that follows the
current position.

**Outcome:** Strong seed.

This is one of the most important overlaps. Movement did not erase context, and
context did not prevent movement. The navigator could descend from 400 events
to 30 accounts while still seeing what the accounts came from. “Pinned” and
“following” are not alternative sensor designs; their overlap is the useful
thing.

### 4. Local controls + current evidence

**Overlap:** a contextual control chart beside a bounded identity view.

**Outcome:** Situational, with a serious warning.

Evidence plus applicable controls is conceptually sound: the navigator sees
both what is present and what can be done from it. But constructing the full
contextual chart was disproportionately expensive in one run, and most
controls were irrelevant to the immediate moment. This should be summoned on
demand, not kept as a permanent dashboard.

### 5. Quiet authors beside referenced accounts

**Overlap:** two identity fields, visible simultaneously, without automatic
merging.

**Outcome:** Strong seed.

This overlap allowed the navigator to hold two incompatible interpretations:
low local activity and explicit field recognition. It remained useful even
when their intersection was empty. The emptiness became a property of this
field rather than a failed search.

### 6. Recognition as intersection

**Overlap:** quietness, explicit references and their mechanical intersection.

**Outcome:** Useful ingredient.

The intersection turned two senses into a doorway. It worked well in the first
run, producing four candidates, and honestly produced zero in the second. But
an intersection handle by itself is an operation result, not an inhabitable
interface. It belongs inside the two-field arrangement from experiment 5.

### 7. Recognition and its negative space

**Overlap:** intersection and difference held together.

**Outcome:** Strong seed.

Showing “recognized” without “not recognized” would have over-weighted the
preferred doorway. The paired result—zero recognized, thirty outside the
reference set—made the selection pressure visible. This is a compact and
powerful overlap: a derived set should often travel with its remainder.

### 8. Two topics without choosing one

**Overlap:** privacy and music projections shown in parallel.

**Outcome:** Situational.

The asymmetry was dramatic: zero privacy matches and one hundred music
matches. Looking at examples revealed that much of the “music” field was
templated search-link material rather than a musical community. Parallel
topics were useful because one projection prevented the other from feeling
like the whole field. The fixed keywords, however, were arbitrary; the
arrangement is reusable, the particular lenses are not.

### 9. Topic collision

**Overlap:** two topical evidence sets plus their subject intersection.

**Outcome:** Weak.

This required converting relation rows back into event subjects before set
composition. It then produced an empty intersection. The result was honest,
but the conversion ceremony dominated the intellectual value. Collision is
worth invoking when the navigator explicitly wonders about overlap; it is not
a habitual panel.

### 10. One question with plural evidence

**Overlap:** one open question carrying two incompatible evidence handles.

**Outcome:** Strong seed.

This was extremely small and disproportionately useful. The question remained
external judgment, while the engine-owned evidence remained separate and
traceable. Nothing attempted to synthesize an answer. It gives multiple views
a reason to coexist without forcing them into one score or result.

### 11. Recognition + identity descent

**Overlap:** a candidate doorway, explicit relay hydration and profile senses.

**Outcome:** Strong but conditional.

When candidates existed in the first pass, four accounts led to three profile
events and four resolved profile rows. In the final field, the doorway was
empty and the descent did not run. That is correct: an interface should not
manufacture a journey when the current universe does not support it. This is a
good hatch attached to a candidate view, not a permanent sensor.

### 12. Identity + authored evidence

**Overlap:** candidate identities, bounded external acquisition and
conversation senses.

**Outcome:** Strong but conditional.

The first pass produced 80 authored notes from four candidates. Profiles answer
“who claims to be here”; authored evidence answers “what appears to happen
around this identity.” Their overlap supported judgment far better than either
alone. It is expensive enough that the navigator must explicitly open it.

### 13. Working cargo + export intention

**Overlap:** the same evidence can be held as temporary working material or as
material intended for an artifact.

**Outcome:** Useful ingredient.

This made collection tempo visible without changing engine truth. It was inert
when the candidate set was empty and useful after the successful descent. The
distinction should remain lightweight: two pockets, not a general-purpose file
manager.

### 14. Curiosity + momentum

**Overlap:** a live question, a current position and a bounded collision trail.

**Outcome:** Situational.

Associating movement with a named curiosity helped explain why a command was
performed. The pinball metaphor did not add enough beyond that. The valuable
part is question-conditioned motion with a short visible trail; the “ball” and
“collision” vocabulary is disposable.

### 15. One ground, two exposures

**Overlap:** stable field, two mechanical projections and an explicit contrast.

**Outcome:** Strong seed.

This was more useful than simply placing two panels side by side because it
retained the common ground and described the count difference without
interpreting it. Zero privacy versus twenty-five music matches in the bounded
exposures was immediately legible. This is an excellent shape for questions of
the form “how does this same universe look through A and B?”

### 16. Linear probe + two reservoirs

**Overlap:** a descent trail, retraction and two simultaneous collection
pockets.

**Outcome:** Mixed.

The underlying overlap is useful: move deeper, preserve the path, and place
different findings into different pockets. The anatomical metaphor obscured
that simple activity, while raw command drafts still leaked through the
executor. Keep the trail/retract/pockets combination; discard the present
surface language.

### 17. Position + fluent local motion

**Overlap:** current handle, local motion grammar and an escape to complete
engine power.

**Outcome:** Weak for a human navigator.

It was convenient for writing the experiment, but it mostly shortened command
construction. It did not arrange attention or make several kinds of evidence
coexist. This is infrastructure ergonomics, not yet a navigator interface.

### 18. Dock + map + work

**Overlap:** local senses, compatible operations and one shaping step.

**Outcome:** Weak.

The map made the full local possibility space visible, but produced the
largest response of the round (about 12.3 KB). It recreated the “too many
controls” problem one level down. A map is useful when explicitly requested;
keeping it open is not useful simplification.

### 19. Evidence + available controls

**Overlap:** a bounded evidence view beside grouped applicable controls.

**Outcome:** Useful ingredient.

This is the refined version of experiment 18. On an empty handle it correctly
felt inert. On a populated handle it can answer “what can I do from exactly
this?” It should expose a few control families progressively, not enumerate the
entire contract.

### 20. Full overlap without totality

**Overlap:** Home, three sensors, two interpretations, an open question, cargo
and one gate.

**Outcome:** Dead end in its current form.

Everything was individually coherent, but the same handles and questions were
represented repeatedly by Bridge, Parallax and Expedition. The 5 KB result was
bounded yet conceptually duplicative. This is the crucial negative result:
combining useful overlaps by nesting their existing containers does not create
a better overlap. The functions must share one spatial and state vocabulary,
not carry three miniature applications beside one another.

## What the experiments say

### 1. Useful overlap is not feature accumulation

The strongest experiments joined capabilities that corrected each other's
blind spots:

- structure corrected anecdotal examples;
- examples corrected abstract structure;
- pinned ground corrected disorienting movement;
- moving focus corrected static context;
- an intersection corrected two unrelated fields;
- its negative space corrected the intersection's selection bias;
- a question gave plural evidence a reason to coexist;
- authored evidence corrected profile self-description.

The dead-end maximal cockpit accumulated containers instead. It had more
features but less unity.

### 2. A promising cockpit grammar appeared

The winners can be expressed as six reusable relationships rather than as
twenty named mini-applications:

1. **Ground** — one stable universe or subject remains visible.
2. **Focus** — one position moves while Ground stays put.
3. **Lenses** — two or three projections of Ground coexist.
4. **Tension** — a selected result remains paired with its alternative,
   remainder or contrasting projection.
5. **Question** — plural evidence attaches to a navigator-owned inquiry.
6. **Hatch and pockets** — expensive descent is explicitly opened, and useful
   consequences can be held temporarily or carried toward export.

This is not a final vessel. It is a vocabulary for making further overlapping
systems without rebuilding the whole controller or hiding engine operations.

### 3. Controls should appear at the point of tension

The full local chart and dock map were too broad. Controls became meaningful
when attached to an evident situation:

- intersect these two visible fields;
- inspect this unresolved identity;
- descend from these candidates;
- return to this Ground;
- place this result into working or export cargo.

This suggests that controls should be consequences of visible relationships,
not a global menu and not an engine-generated recommendation.

### 4. Empty results are interface tests

The second live field produced no quiet/reference intersection. The best
overlaps remained meaningful:

- Parallax showed both populated parents.
- Negative space showed all thirty candidates outside the reference set.
- The question retained the failed hypothesis as evidence.
- Conditional hatches did not pretend there was somewhere to descend.

The weaker arrangements became blank collections or inert control lists.

### 5. Maximal capability requires modulation, not simultaneous display

The maximal experiment did not show that a highly capable cockpit is
undesirable. It showed that placing every subsystem on screen at equal
intensity creates duplication.

The correction is modulation:

- Ground, Focus, Lenses, Tension, Question, Hatches and pockets remain parts of
  one active system.
- Their visibility, size, detail and responsiveness change with the voyage.
- They continue to affect one another while their emphasis changes.
- Questions, cargo, position and provenance persist through those changes.

This is not a sequence of isolated modes or separate applications. A useful
overlap must work simultaneously before modulation can make it larger or
quieter.

### 6. The next experiment should be spatial

The current outputs are still structured records. The next useful test is not
another wrapper. It is one visual cockpit prototype using the six
relationships above:

- Ground as the stable surrounding field;
- Focus in the center;
- two or three Lenses around it;
- Tension visibly connecting sets;
- Question as an attachable rail rather than a text box;
- Hatches appearing on subjects and relationships;
- two small cargo pockets;
- one executor gate where the navigator confirms movement.

The prototype must then modulate these connected elements instead of replacing
one arrangement with another. The complete system remains underneath. The test
is whether useful overlaps remain coherent while their emphasis changes.

## Record

The one-off live harness used three public relays, one 400-event bounded field
and ordinary controller/session commands. It was removed after this report
distilled the outcomes; superseded experimental machinery is not retained as
product architecture.
