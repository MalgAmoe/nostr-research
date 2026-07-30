# Evidence Desk voyage 3: Skeptic invalidation of a photography candidate

Date: 2026-07-30  
Status: completed live-relay trial; no Evidence Desk code changes

## Question

Can Evidence Desk support the established Skeptic posture: record an initial
selection reason, inspect profile and authored evidence, actively seek evidence
that could weaken the reason, and retain a qualified outcome without converting
mechanical recurrence into an accusation?

## Candidate and initial reason

The candidate came from voyage 2's creative-term branch:

- account: `9838095b535c1076a0baa7a45ee2c069c0ad61d7155e8d2c9b42eb1ef456820c`;
- profile name claim: `naturestr`;
- NIP-05 claim: `_@naturestr.com`;
- profile description claim: nature enthusiast and outdoor photographer;
- observed entrance note: a photography hashtag template linking a Pexels
  image.

Initial reason, stated before descent:

> The account may be a useful nature-photography candidate because its profile
> claims outdoor photography and it appeared in the creative-term branch.

The reason was explicitly provisional. Profile claims and branch selection did
not establish original work.

## Invalidation route

The chosen weakening test was:

> Inspect bounded authored behavior and test whether the observed photography is
> recurrent third-party/template material rather than evidence of original
> work.

One explicit relay continuation acquired authored notes:

- 30 event subjects;
- all 30 resolved from the buffer;
- one author;
- the distinct-event budget was reached;
- the attempt was partial and non-exhaustive.

Evidence Desk summary exposed those bounds before preview. The first twelve
cards all used a regular pattern:

```text
#nature #naturestr [#photography] #nostr
+ one images.pexels.com or videos.pexels.com URL
```

The notes appeared at regular-looking intervals, but no scheduling or automation
claim was made from that visual pattern.

## Mechanical recurrence test

The authored handle left the desk for relation analysis:

```text
30 authored event subjects
→ relate
→ scan event.text for substring pexels.com
→ 30 match rows
→ extract subject.id
→ 30 event subjects
→ Evidence Desk
```

Every event in the bounded authored result contained `pexels.com`. Returned
cards preserved the Pexels URLs, template text, event IDs, evidence resolution,
and relay provenance.

This supports a narrow claim:

> All 30 events in this bounded authored-note attempt referenced Pexels.

It does not establish:

- automation;
- deception;
- who owns the images;
- whether original work exists outside the bounded result;
- complete account history;
- the intent behind the account.

## Judgment

The original reason did not survive. The account was not retained as an
original-photography candidate.

The existing notebook entry from the Breadth voyage was updated explicitly:

- judgment: `uninterested`;
- strength: `0.8`;
- labels: `creative-term-branch`, `pexels-recurrence`;
- attribution: `evidence-desk-skeptic-voyage-3`;
- reason: the original-photography reason did not survive bounded authored
  evidence;
- qualification: no automation, deception, or ownership conclusion.

No evidence was archived because the candidate failed the stated collection
reason. The notebook entry count remained stable: the existing subject judgment
was revised rather than duplicated.

## Desk-use record

| Entry | Mode | Decision | Exit or return |
| --- | --- | --- | --- |
| Candidate account | Details from voyage 2 | State initial reason | Stay with account handle |
| Authored result | Summary | Confirm bounds and partiality | Stay in desk |
| Authored result | Preview | Identify recurrent template/source pattern | Exit to relation scan |
| Pexels-matched subjects | Summary and preview | Confirm 30/30 bounded recurrence | Return to desk |
| Candidate account | Details after judgment | Verify attribution and qualification | End in desk |

Evidence Desk worked well for profile claims, authored cards, bounded summary,
returned match cards, and exact notebook detail. The initial reason and
profile-versus-behavior tension still lived in voyage notes rather than in one
simultaneous desk surface.

## Answer

Yes. Evidence Desk supported the Skeptic sequence without absorbing relation
analysis or inventing a negative label:

```text
profile claim
→ explicit initial reason
→ bounded authored evidence
→ mechanical invalidation test
→ returned evidence cards
→ qualified notebook revision
```

This voyage also demonstrates why profile claims and authored evidence are a
strong overlap: neither alone answered the selection question. The desk made
both readable, while the navigator retained responsibility for the test and
conclusion.
