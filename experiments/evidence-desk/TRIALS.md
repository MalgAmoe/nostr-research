# Evidence desk trial record

## Hypothesis

A navigator-facing experiment should begin with notes and accounts rather than
controller outcomes, handles, or command construction. Evidence visualization
and action controls should remain separate, and every action should compile to
visible ordinary commands.

## Iteration 1: evidence cards

The first arrangement consumed already-requested preview responses and produced:

- note cards for kind-1 events;
- account cards for account collections;
- account cards backed by clearly retained kind-0 metadata-event identities;
- separate claim, evidence, inclusion, paging, acquisition, and lineage facts.

Real in-process tests used the engine and neutral controller rather than copied
response fixtures. Pure arrangement left controller request counts unchanged.

A first failure showed that contextual handle schemas do not advertise `show`
modes. The desk now labels its five explicit observation doors as an interface
vocabulary; it does not attribute them to contextual schema output.

## Iteration 2: operational cards

A card must be more than a rendering. `composeCardFocus()` was added and tested:

- a note or account subject emits one visible `pick`;
- an account displayed from a profile event emits visible
  `pick → move authors` commands;
- an explicit subsequent `show` returned the exact selected object.

This preserves the distinction between an immutable metadata event and the
account it describes instead of hiding that distinction behind the account
card. A later review caught that several metadata events can share one account
ID; cards now have a unique source-stable `cardId` separate from their primary
account `id`, with a dedicated duplicate-profile test.

## Iteration 3: object-first text

Retained live outcomes were arranged for:

| Live observation | Result |
| --- | --- |
| 280-event acquisition preview | 12 note cards, 268 paging omissions retained |
| six acquired metadata events | six account cards with source event IDs |
| sampled account collection | two account cards with transformation context |

The first text version still foregrounded handles and raw Unix timestamps. It
was revised to:

- lead with note/account counts;
- display readable timestamps alongside exact Unix values;
- move the source handle to a technical footer;
- label NIP-05, names, and descriptions as claims;
- retain full event/account identifiers and evidence source.

## Iteration 4: persistent-session journey

A fresh journey used the existing persistent neutral controller:

```text
sampled Yarnlady account card
→ pick position 2 as deskLiveAccountFocus
→ explicit show preview
→ one matching Yarnlady account card
```

Only these visible commands were executed:

```json
{"command":"pick","input":"communityTrialSample","parameters":{"positions":[2]},"resultId":"deskLiveAccountFocus"}
{"command":"show","input":"deskLiveAccountFocus","parameters":{"mode":"preview","previewLimit":1,"excerptLimit":500,"sizeLimit":12000}}
```

The resulting evidence remained resolved from the buffer, with the profile
claim's metadata event and three relay sources visible. No hidden schema or
observation request occurred.

The caller then explicitly requested broad account schema and focused
continuation schema. The desk exposed operation controls plus factual
relationship choices including authored notes, profiles, follow lists,
followed accounts, and followers, each separated by local or relay source.

## Iteration 5: visible variants

Focused schema choices were expanded mechanically into command variants:

- one move variant per declared route;
- one continuation variant per declared relationship/source pair;
- one preservation variant per declared level, retaining `reason` as visibly
  required.

No variant is ranked or selected. A composition bug initially replaced variant
parameters when adding bounds or reasons; tests caught it, and composition now
merges navigator-supplied fields into the visible variant.

## Iteration 6: account to conversation evidence

A live account card was continued through the schema-declared local
`authored-notes` route. The desk produced nine notes, retained preview paging,
and showed author claims and evidence sources. This exposed that continuation
context was missing from the arrangement. The desk now retains and renders:

- relationship and source;
- input count and result limit;
- attempt status and data scope;
- exhaustiveness and reached bounds.

One authored note was focused and its focused continuation schema expanded into
visible local/relay variants for replies, ancestors, mentions, quotes,
referenced events, conversation, shared tags, and linked domains.

## Iteration 7: unresolved to resolved evidence

Local ancestor continuation returned two valid event references whose canonical
evidence was unavailable. Early text called their authors “unknown” and omitted
available relationship evidence. It now renders them as unresolved references
with `reply-parent` and `reply-root` inclusion types.

An explicit relay ancestor continuation resolved both references as notes. The
new pure `compareEvidenceFrames()` mechanically reported two shared subjects
changing from `unresolved` to `buffer`. Its first field names, `added` and
`removed`, were rejected as too causal for differently narrowed frames and
renamed to `onlyBefore`, `onlyAfter`, and `shared`.

## Iteration 8: preservation and notebook controls

One resolved root note was focused. Broad and focused schemas produced a
canonical-preservation variant with a visible required reason. Executing it
changed the next card's resolution source from `buffer` to `archive`.

The first notebook command failed because the focused contract required
`reason` and `attribution`, but the desk exposed those only as prose. This was a
desk defect, not an engine defect. Actions now derive mechanical `required` and
`atLeastOne` requirements from focused contracts, and composition rejects an
incomplete command before execution. The corrected visible command succeeded;
status confirmed one canonical archive entry and one notebook entry.

## Iteration 9: all observation modes

Testing all five observation doors found a substantial shape error:

- summary paging was presented as missing cards;
- detail wrappers became empty generic events;
- explanations were marked unsupported;
- coverage facts disappeared.

Version 2 now gives each mode its own arrangement. Live output retained summary
resolution and event facts, detailed notebook attribution and freshness, exact
NIP-10/continuation explanations, provenance omissions, and coverage source
counts. Account details also preserved the distinction between card evidence
relays and detail-path provenance.

## Iteration 10: buffer turnover

A visible 100-event acquisition filled the 700-event buffer and caused 21
evictions. Re-observation showed:

- the preserved/notebook note still resolved from the archive with canonical
  content, reasons, attribution, and historical provenance;
- archive and notebook counts remained one each;
- an unarchived account profile used in the trial still happened to remain in
  the buffer, so this voyage did not demonstrate its eventual unresolved state.

## Iteration 11: five sustained voyages and acquisition coverage

Five additional live voyages confirmed the desk's intended boundary:

- note → account → authored notes remained natural even when profile claims were
  honestly absent;
- a 300-note relation scan left the desk and returned eight extracted note
  subjects cleanly;
- preview, summary, details, explain, and coverage served distinct inspection
  depths;
- local and relay ancestor frames compared without invented causal changes;
- 35 visible action choices confirmed that truthful enumeration remains noisy
  and is slower than direct commands for an expert with a known intent.

The voyages found one genuine defect: acquisition coverage is returned as a
root-level `acquisition-coverage` report, while the desk only arranged nested
collection coverage. Relay participation, counts, budgets, completion, and
uncertainty therefore disappeared. The fix adds a dedicated bounded root-report
arrangement and renderer, verified through a real in-process acquisition with
one EOSE relay and one connection failure. No action grouping, hydration
shortcut, or relation support was added.

## Iteration 12: sustained conversation and author-context voyage

A fresh bounded field led from a random reply through unresolved local
ancestors, explicitly acquired thread evidence, explanation provenance, profile
hydration, 30 bounded authored notes, relation scanning, and nine extracted note
cards returning to the desk. The complete record is
[`docs/voyages/EVIDENCE-DESK-VOYAGE-1.md`](../../docs/voyages/EVIDENCE-DESK-VOYAGE-1.md).

The voyage confirmed natural relation exit and return, honest absent profile
claims, and useful `unresolved → buffer` comparison. It also confirmed action
pressure: 35 visible choices were available when only local and relay ancestors
mattered. Known direct commands remained faster for movement and relation work.

One narrow summary defect printed `undefined omitted` when `omittedCount` was
absent and failed to render declared continuation completeness. The post-voyage
fix now omits absent bound fields and displays status, scope, exhaustiveness,
omission count, and reached bounds. No action-surface feature was added.

## Iteration 13: Breadth across parallel evidence branches

The second sustained voyage applied the repository's established Breadth
posture to one 240-note Ground. Media, creative-term, and inquiry-term relations
returned 44, 3, and 10 note subjects to the desk. Their cards weakened the
surface interpretations: creative evidence was mostly templated photography,
and inquiry matches included incidental phrasing and automation.

Three deterministic account samples produced nine distinct unresolved
accounts. One explicit hydration returned ten metadata events while resolving
the nine account subjects. Branch-separated cards supported three shallow,
qualified `uncertain` judgments without authored descent or preservation. The
complete record is
[`docs/voyages/EVIDENCE-DESK-VOYAGE-2.md`](../../docs/voyages/EVIDENCE-DESK-VOYAGE-2.md).

The desk worked at each evidence stop and accepted relation-derived handles
cleanly, but it did not keep Ground and all three branch frames visible together.
Breadth therefore depended on named handles and voyage notes more than the Depth
journey did.

The voyage found two empty summary labels. A narrow fix now renders numeric
acquisition bounds and suppresses origin lines without displayable facts. Three
invalid notebook commands also exposed a focused-schema gap: optional notebook
`kind` values were not enumerated. The later milestone consolidation corrected
that shared factual contract without changing Evidence Desk.

## Iteration 14: Skeptic invalidation

The third sustained voyage reused one Breadth finalist whose profile claimed
nature photography. A 30-note bounded authored result showed a regular
hashtag-plus-Pexels-link pattern. Relation scanning established that all 30
bounded notes contained `pexels.com`; it did not establish automation,
deception, ownership, or complete history.

The original-photography selection reason did not survive. The existing
notebook judgment was revised with an attributed `uninterested` outcome and
explicit caveats; no evidence was archived. The complete record is
[`docs/voyages/EVIDENCE-DESK-VOYAGE-3.md`](../../docs/voyages/EVIDENCE-DESK-VOYAGE-3.md).

The desk supported claims, authored cards, bounded summary, relation return, and
notebook verification. The initial reason and profile-versus-behavior tension
still lived in voyage notes rather than one simultaneous surface. No new desk
defect or feature requirement emerged.

## Current assessment

An earlier universal outcome-orientation experiment was removed after showing
that caller-side presentation cannot recover facts absent from local operation
responses. This desk instead works with the system's explicit
command/observation separation.

Three different sustained voyages now support a bounded conclusion:

> Evidence Desk is a single-frame note/account decision surface.

It was a natural recurring home for Depth and Skeptic work around one current
subject or evidence frame. Breadth established its boundary: each branch was
readable in the desk, but Ground, parallel branches, contrasts, and finalists
were held together by named handles and voyage notes. A separate multi-frame
system may test that activity without replacing or depending on this desk.

Proven strengths:

- notes and accounts are genuinely primary;
- summary establishes bounds and partiality before preview;
- preview, details, explain, and coverage remain distinct evidence senses;
- source events, profile claims, authored behavior, evidence resolution,
  provenance, inclusion reasons, and notebook judgments stay distinct;
- exact card focus remains operational through visible ordinary commands;
- relations can be left for mechanical analysis and returned as subject handles;
- profile claims and authored behavior form a productive overlap without either
  becoming a trust conclusion;
- notebook revisions support changed conclusions without duplicating subjects;
- neutral frame comparison reports evidence-state changes without causality.

Open or deliberately unpromoted:

- relations need a different visualizer rather than forced desk support;
- Ground-versus-branch and reason-versus-evidence tension remain outside the
  single frame;
- unresolved-account hydration repeatedly mattered and is the strongest
  candidate for a future situational hatch, but no shortcut is added yet;
- the complete action arranger is truthful, but its 35-choice catalogue was
  ignored when the navigator already knew the intended action and has not earned
  permanence;
- card focus relies on stable preview positions; offset paging was verified,
  while alternative presentation orderings would require another strategy;
- focused contracts remain bounded by the facts their schemas declare. The
  Breadth voyage's missing notebook `kind` values were corrected in the shared
  contract rather than worked around by this experiment;
- text rendering is sufficient for trials; no visual implementation is implied.

The feature set remains frozen. Additional single-frame voyages are unlikely to
change the central conclusion unless they expose a concrete correctness defect.
