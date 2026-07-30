# Evidence Desk voyage 1: a random reply into conversation and author context

Date: 2026-07-30  
Status: completed live-relay trial; no Evidence Desk code changed during voyage

## Question

Can a random live note lead to a coherent conversation and useful author
context while keeping thread structure, provenance, acquisition limits, and
every movement explicit?

## Entrance

One explicit acquisition requested 120 kind-1 events from three relays.

- 128 observations were accepted.
- 120 distinct events were acquired.
- 8 observations were duplicates.
- 2 directly content-warned events were excluded.
- One relay reached EOSE; two attempts stopped at the distinct-event budget.
- The full 700-event buffer evicted 120 older events.
- The acquisition was partial and non-exhaustive.

A deterministic eight-note sample was shown in preview. The cards immediately
distinguished human text, news-like text, machine JSON, advertisements, media,
and terse conversation without exposing protocol structures as the primary
surface.

The chosen entrance was position 3:

> They are normally called mercenaries.

Its author was initially only a public key. One visible `pick` focused the exact
note.

## Desk-use record

| Entry | Mode | Selected action | Ignored noise | Exit and return |
| --- | --- | --- | --- | --- |
| Eight sampled notes | Preview | Focus note 3 | Seven other entrances | One `pick`; returned as one note |
| Focused note | Details | Inspect evidence, then ancestors | Five observation doors and unrelated operations | Stayed in desk |
| Focused note controls | Focused continuation schema | Ancestors · local | Thirteen other continuation variants | Returned two unresolved event references |
| Local ancestors | Preview | Ancestors · relays | No automatic retry | Returned the same two subjects with buffer evidence |
| Relay ancestors | Explain | Inspect exact reasons and provenance | Other observation modes | Stayed in desk |
| Focused note | Ordinary `move → authors` | Inspect author | Action catalogue | Returned one account handle |
| Unresolved account | Preview | Explicit hydration | Other account actions | Returned one metadata event and refreshed account evidence |
| Resolved account | Summary, then preview | Authored notes · relays | Details and explain | Returned 30 authored-note cards |
| Authored notes | Relation tools | Relate, scan, extract | Desk shaping catalogue | Returned nine event subjects to desk |
| Extracted subjects | Summary, then preview | Inspect recurrent notes | No further action | Voyage ended in desk |

## Conversation evidence

Local ancestor traversal was complete over the resident corpus but returned two
unresolved event references:

- `reply-parent`:
  `0cfd25d96dec01ad3c4a1a37a45f6dba3c1f08b15512931232cc6280648f2f9d`
- `reply-root`:
  `000031d3ed1a19a8ce8dce67ab05e80312a6b33a4f4d5cbbd3e92a906c30216a`

A separate explicit bounded relay continuation resolved both:

> Are there no examples of armies without states?

and the root question:

> How is a functioning free society that respects the rights of the individual
> possible, when next door to it there's a highly organized totalitarian nation
> with sophisticated technology and weapons? ... #asknostr

`compareEvidenceFrames()` reported:

- 2 shared subjects;
- no subjects only before or only after;
- 2 resolution changes from `unresolved` to `buffer`.

It did not describe the later frame as causing or improving the earlier one.
Explain mode retained the NIP-10 `reply-parent` and `reply-root` reasons, the
explicit relay continuation reason, and per-relay observations. The relay view
was complete for its bounded attempt and explicitly non-exhaustive.

## Account and authored evidence

Moving the focused note to its author produced an unresolved account:

`b761b35e14dfe7eadbeeb716bc47b9a2c1c703b2ee9827caa415a4e3b6a50cc6`

One explicit hydration resolved one metadata event. The desk then displayed the
name **Peace K 🪙** and a Monero address in the description while labelling both
as profile claims. The original account handle re-resolved without replacement.

A bounded relay continuation requested authored notes:

- 30 distinct notes were returned;
- all 30 resolved from the buffer;
- one author was represented;
- the attempt stopped at the distinct-event budget and was partial;
- the view was not an exhaustive author history.

The preview showed repeated discussion of rights, states, force, government,
armies, anarchism, land, and political conflict.

## Relation exit and return

The apparent recurrence was tested mechanically outside Evidence Desk:

```text
30 authored event subjects
→ relate
→ scan event.text for rights, state, anarchist, government, army
→ 17 field/term match rows
→ extract subject.id
→ 9 distinct event subjects
→ Evidence Desk
```

The nine returned cards supported the narrow claim that these terms recur in
the bounded authored-note result. They do not establish expertise, consistency,
trustworthiness, or complete account history.

The relation exit felt natural. Relation rows did not need to become desk cards,
and extracted event handles returned without adaptation.

## Action pressure

For the focused note, the desk exposed:

- 5 observation doors;
- 3 navigation operations;
- 14 loaded continuation variants;
- 8 shaping operations;
- 3 judgment operations;
- 2 preservation operations.

That is 35 visible choices when variants are counted. Only two mattered at that
moment: local ancestors and relay ancestors. Once the intended operation was
known, issuing ordinary `move`, `relate`, `scan`, and `extract` commands was
faster than reading the catalogue.

No grouping or progressive-disclosure change is justified from this voyage
alone.

## Defect observed

The authored-note summary rendered:

```text
bounds · 30 output · undefined omitted · truncated false
```

The response did not declare `omittedCount`. The formatter should omit that
clause rather than print `undefined`. A narrow post-voyage fix now renders only
declared bound fields and also surfaces the response's partial completeness,
non-exhaustiveness, omission count, and reached distinct-event bound. A real
local-continuation summary assertion prevents the original regression.

## Answer

Yes. The desk supported a complete evidence path:

```text
random note
→ exact focus
→ unresolved local thread references
→ explicitly acquired thread evidence
→ explained provenance
→ unresolved account
→ explicit profile hydration
→ bounded authored evidence
→ relation analysis
→ extracted note cards
```

It was most useful for reading, exact focus, evidence-state transitions,
provenance, and returning from analysis. It was least useful when the intended
engine command was already known and the full action catalogue had to be
ignored.
