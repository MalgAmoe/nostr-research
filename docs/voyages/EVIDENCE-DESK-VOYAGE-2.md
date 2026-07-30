# Evidence Desk voyage 2: Breadth across three parallel signals

Date: 2026-07-30  
Status: completed live-relay trial; Evidence Desk feature set remained frozen

## Question

Can Evidence Desk support several parallel evidence interpretations without
collapsing them into one preferred candidate or losing the stable ground?

This voyage reused the established Breadth posture:

- establish three signals before choosing candidates;
- give each signal one account/profile step;
- compare branches before judgment;
- do not open authored histories or a second ring;
- retain only qualified uncertain candidates.

## Ground

One explicit acquisition requested 240 kind-1 events from three relays.

- 265 observations were accepted.
- 240 distinct events were acquired.
- 25 observations were duplicates.
- 1 directly content-warned event was excluded.
- 142 distinct authors were represented.
- The distinct-event budget stopped the non-exhaustive attempt.
- The full buffer evicted 240 older events.

Evidence Desk summary gave compact ground orientation. A six-note preview showed
machine output, linked news, multilingual material, and ordinary short text.
The ground remained available as an ordinary handle, but Evidence Desk did not
keep it spatially visible while branch frames were inspected.

## Three pre-selection signals

The ground was related once, then three mechanical branches were derived.
Every relation was extracted back into event subjects before returning to the
desk.

| Branch | Mechanical construction | Relation rows | Distinct note cards |
| --- | --- | ---: | ---: |
| Media | `event.hasMedia == true` | 44 | 44 |
| Creative terms | word scan for art, music, poetry, photo, design | 3 | 3 |
| Inquiry terms | word scan for why, how, question, help, anyone | 10 | 10 |

The cards corrected the branch names:

- Media was broad and heterogeneous: machine reliability cards, newsletter
  promotions, conference material, and bare images.
- Creative-term evidence was mostly templated photography links plus one linked
  news item; it did not establish a creative community.
- Inquiry terms included incidental phrasing and automation. One apparently
  personal alcohol/health reply and one self-hosting comment were visible, but
  the branch was not generally a question field.

The branch labels remained caller-chosen lenses rather than engine conclusions.

## Account sampling and hydration

Each branch received exactly one account step:

| Branch | Authors | Deterministic sample |
| --- | ---: | ---: |
| Media | 36 | 3 |
| Creative terms | 3 | 3 |
| Inquiry terms | 9 | 3 |

The two unions produced nine distinct accounts, so the three samples had no
subject overlap. Before hydration all nine account cards were unresolved.

One explicit hydration attempt resolved the account set. It returned ten
immutable metadata events for nine account subjects, demonstrating that profile
event count and account completeness are different dimensions. The account
handle remained deduplicated at nine cards.

Branch-separated account views retained selection context:

### Media sample

- `SemperFidelis17`, with political/patriotic profile claims;
- `infobites.info`, with only a sparse name claim;
- Netasgard News FI, explicitly claiming continuous linked-source news.

### Creative-term sample

- `naturestr`, claiming nature photography;
- Netasgard News DE, claiming real-time linked headlines;
- `animalstr`, claiming wildlife photography.

The source note cards made the likely templated character of the photography
accounts visible without assigning an automation or originality judgment.

### Inquiry-term sample

- `crypticCypher`, claiming industrial automation, radio, hiking, and nature;
- `imad gaza`, carrying an attributed donation/profile appeal;
- `Mary`, claiming writing and marketing work.

The branch evidence showed that at least one inquiry match was incidental rather
than an actual question.

## Finalists and judgment

One finalist per branch was inspected in detail, without authored descent:

- **Media — `infobites.info`:** only a name claim; source quality and authored
  behavior uninspected.
- **Creative — `naturestr`:** profile claims nature photography; the observed
  note was a templated Pexels link; originality untested.
- **Inquiry — `crypticCypher`:** richer person-like technical/outdoor claims;
  inquiry-term selection appeared incidental; authored behavior uninspected.

All three were explicitly remembered as `uncertain` at strength `0.3`, with
branch labels, reasons, attribution, and qualification notes. No evidence was
archived. The voyage added three notebook entries.

## Construction failure and schema gap

The first three `remember` commands supplied:

```json
{"kind":"breadth-candidate"}
```

All failed atomically with `INVALID_OPERATION` because that notebook
classification is invalid. No notebook state changed.

The subsequently requested focused schema described `kind` only as:

```text
optional notebook classification
```

It did not enumerate the accepted values. Removing the optional field allowed
the engine to derive the correct judgment entry kind, and all three commands
then succeeded.

This is not an Evidence Desk defect. It exposed a contextual-schema gap: an
unfamiliar command could not be fully constructed from that focused contract.
No core change was made during the voyage. The later milestone consolidation
corrected the shared contract so full and focused schemas enumerate
`judgment`, `note`, `derived-observation`, and `summary` from the same factual
list used by notebook validation.

## Desk-use record

| Entry | Mode | Selected action | Exit or return |
| --- | --- | --- | --- |
| 240-note Ground | Summary and preview | Establish three signals | Exit to relation tools |
| Media subjects | Summary and preview | Move to authors, sample three | Return as account cards |
| Creative subjects | Summary and preview | Move to authors, sample three | Return as account cards |
| Inquiry subjects | Summary and preview | Move to authors, sample three | Return as account cards |
| Nine-account union | Preview | Explicit hydration | Return as resolved account cards |
| Three branch samples | Preview | Select one finalist each | Remain in desk |
| Three finalists | Details | Record qualified uncertainty | Exit to notebook commands |

The desk was useful for reading branch evidence, exposing collective unresolved
state, comparing profile claims, and exact finalist focus. It did not provide a
single spatial view where Ground and all three branch frames coexisted. That
absence was manageable through named handles and voyage notes, but the Breadth
posture felt less naturally housed than the earlier Depth voyage.

## Post-voyage formatter corrections

The acquisition summary exposed two empty text labels:

```text
bounds
origin
```

The summary had acquisition budget facts, but no collection-style output-bound
fields; its origin object contained no renderable origin label. A narrow
post-voyage correction now:

- falls back to declared numeric acquisition bounds;
- emits `origin` only when a renderable operation/source fact exists;
- has a real acquisition-summary regression assertion.

No action grouping, pinned Ground, hydration shortcut, or parallel-frame
feature was added.

## Answer

Evidence Desk can participate in Breadth, but it is not itself a complete
Breadth surface.

It performed well at each note/account evidence stop and accepted every
relation-derived handle cleanly. The navigator could maintain three independent
branches and delay judgment. However, parallel interpretation depended on
external handle naming and notes because the desk presents one frame at a time.

This supports the larger composition:

```text
stable named Ground
→ relation lenses
→ Evidence Desk branch cards
→ shared account hydration
→ Evidence Desk finalist details
→ explicit notebook judgment
```

The desk remains a strong evidence place inside the voyage, while Ground,
parallel tension, and relation analysis remain outside it.
