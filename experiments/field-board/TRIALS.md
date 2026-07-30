# Field board trials

## Hypothesis

A bounded multi-frame board can keep Ground, parallel branches, their observed
summary facts, and caller-defined reasons understandable together without
becoming a subject viewer or command executor.

Success criterion:

> The navigator can understand and compare the active research field without
> opening every handle or maintaining the branch structure manually.

Discard criterion:

> The board merely becomes a handle list with labels.

## Constraints

- Accept only ordinary handles and already-requested summary outcomes.
- Execute nothing and accept no controller capability.
- Import no other experiment.
- Keep one Ground and a bounded, ordered, one-level branch set.
- Preserve caller reasons, bounds, resolution, completeness, and lineage as
  separate facts.
- Compare mechanically without ranking.
- Return unchanged handles for other surfaces.

## Trial 1: three-branch Breadth reconstruction

The first trial reconstructed the exact live Breadth field recorded in Evidence
Desk voyage 2. It read retained controller transcript entries 160–174 and issued
no engine command.

### Ground

| Frame | Handle | Kind/count | Reason |
| --- | --- | --- | --- |
| Ground | `voyageBreadthGround2` | 240 events | Bounded kind-1 acquisition from three named relays |

The board simultaneously retained the acquisition's 12-second timeout,
340-observation limit, 240-distinct-event limit, concurrency 3, full buffer
resolution, partial status, non-exhaustiveness, and
`distinct-event-budget` completion reason.

### Branches

| Branch | Handle | Count | Caller-defined route reason |
| --- | --- | ---: | --- |
| Media-bearing | `voyageBreadthMediaNotes2` | 44 | Ground relation rows satisfying `event.hasMedia == true`, extracted to event subjects |
| Creative terms | `voyageBreadthCreativeNotes2` | 3 | Ground text matching art, music, poetry, photo, or design in word mode, extracted to event subjects |
| Inquiry terms | `voyageBreadthInquiryNotes2` | 10 | Ground text matching why, how, question, help, or anyone in word mode, extracted to event subjects |

All three appeared under Ground at once. Each retained its extraction lineage,
zero omissions, non-truncated bound, and complete buffer resolution. Neutral
same-kind count ratios beside Ground were 18.3%, 1.3%, and 4.2%, with membership
overlap explicitly left unestablished. Pairwise contrast kept the caller's
branch order and showed counts `44 / 3`, `44 / 10`, and `3 / 10` without
selecting a winner.

### Live corrections

The first rendering compared absolute resolution counts and therefore called
44-buffer versus 3-buffer a resolution difference, even though both frames were
100% buffer-resolved. It also treated `outputCount` as a declared-bound
difference.

The corrected board now:

- compares evidence-resolution proportions while each frame retains absolute
  counts;
- excludes input, discovered, and output cardinality from pairwise bound
  profiles while retaining them on each frame;
- reports these three branches as `resolution profile same` and `bounds same`;
- computes only a same-kind Ground count ratio and disclaims membership
  overlap;
- displays the Ground label, rather than its internal key, as branch parent.

These were board-presentation defects found by the live field, not engine
changes.

### Explicit focus and exit

One local `select('creative')` changed board focus without observation or
execution. `handle()` returned the unchanged ordinary handle:

```json
{
  "id": "voyageBreadthCreativeNotes2",
  "kind": "events",
  "count": 3,
  "revision": 87
}
```

The handle required no adaptation for Evidence Desk, relation analysis, or raw
commands. Functional coverage also verifies explicit branch replacement,
displaced-handle return, and focus following the replacement.

### What became visible without opening handles

The board answered, in one bounded view:

- which handle was Ground;
- that Ground was a partial bounded acquisition;
- which three branches descended from it;
- why each branch existed;
- each branch's type, count, extraction lineage, bounds, and resolution;
- branch size beside Ground and beside every other branch;
- which ordinary handle would leave the board next.

No subject preview was needed. The structure previously carried by voyage prose
was retained by the board after the caller placed each frame and supplied its
reason.

The board did **not** claim branch membership overlap, quality, independence, or
semantic validity. Those facts were unavailable because the original voyage had
not requested set comparisons. Count contrast remained count contrast.

### Assessment

Trial 1 is a provisional pass.

The result is more than a handle list with labels: observed partiality, bounds,
resolution, lineage, Ground count ratios, pairwise contrasts, current focus,
and exit handle coexist. It materially removes the need for separate notes to remember
the active Ground/branch tree.

The caller still has to state a useful branch reason when placing a frame. If
those reasons are vague, the board can collapse back into a labelled handle
list. A stranger branching voyage was therefore required before retaining the
experiment.

## Trial 2: mixed structural branches

The stranger voyage reused the 240-note Ground but branched by structural
movement rather than three same-kind predicates:

```text
Ground notes
├── distinct authors       → accounts
├── referenced events      → events
└── referenced accounts    → accounts
```

Every movement and summary was an explicit ordinary command.

| Branch | Kind/count | Resolution | Bounds |
| --- | --- | --- | --- |
| Author accounts | 100 accounts | 8 buffer, 92 unresolved | 142 discovered; 42 omitted; truncated at default 100 |
| Referenced events | 57 events | 12 buffer, 45 unresolved | 57 discovered; none omitted |
| Referenced accounts | 38 accounts | 2 buffer, 36 unresolved | 38 discovered; none omitted |

The board retained `sourceOperation: acquisition`, one transform stage, the
latest `move` destination, and its limit for every branch. It correctly withheld
a Ground count ratio for the account branches because account and event counts
are not comparable. The 57-event branch showed a 23.8% same-kind count ratio
beside Ground while explicitly leaving membership overlap unestablished.

Pairwise contrast distinguished account/event kinds, resolution profiles, and
the author branch's truncation without ranking the branches. Input, discovered,
and output cardinality remained visible on each frame but were removed from the
pairwise bound profile as redundant count differences.

Explicit focus on referenced events returned the unchanged handle:

```json
{
  "id": "voyageFieldBoardReferencedEvents2",
  "kind": "events",
  "count": 57,
  "revision": 111
}
```

### Failed optional relation branch

An optional fourth branch attempted to explode `event.hashtags`. The relation
schema does not expose that field; it exposes `event.tags`. The command failed
with `INVALID_OPERATION`, created no handle, and changed no session revision.
The batch script then incorrectly issued its prewritten `show` command, which
failed with `UNKNOWN_RESULT`. This follow-up should have been gated after the
semantic failure. It was not retried because three successful mixed branches
already answered the board question.

This was command-construction and orchestration evidence, not a Field Board
failure: the board received neither failed response as a frame.

### Assessment

Trial 2 passes.

The board remained useful when branches had different kinds, unavailable
Ground count ratios, materially different unresolved evidence, and one truncated
output. Those facts would be easy to lose in a handle list and did not require
opening any branch subjects.

Together the first two trials supported retaining the experiment's narrow hypothesis:

> Field Board is a pure multi-frame position and comparison surface for one
> Ground and several explicitly placed branches.

It does not replace Evidence Desk. The board holds field structure and returns
an ordinary handle; a single-frame subject surface, relation tool, or raw
command can take over from there. No dependency between experiments is needed.

## Trial 3: prospective evolving field

A prospective external voyage began with Ground only and added branches as the
research field evolved:

```text
Ground: 260 notes
├── Media-bearing: 51 notes
├── Broad subject words: 5 notes
└── Ground authors: 100 accounts
```

The weak topical branch was then replaced explicitly:

```text
Broad subject words: 5 notes
→ Inquiry words: 11 notes
```

Ground-only orientation was useful before any branch existed. Media exposed a
19.6% same-kind count ratio without an overlap claim. Its unchanged handle
entered Evidence Desk and produced five note cards while Field Board retained
media focus. The mixed account branch withheld a Ground ratio and exposed an
unresolved resolution profile against buffer-resolved Ground. Replacement
returned the displaced handle and transferred focus to inquiry. Final focus
returned the unchanged authors handle. Sixteen controller commands completed
without failures, and neither experiment issued a hidden command.

This confirmed the independent composition prospectively:

```text
Field Board position
→ ordinary handle
→ Evidence Desk inspection
→ unchanged Field Board position
```

### Corrections justified by the voyage

Two narrow frictions were concrete.

First, prospective addition required the caller to maintain an external branch
array and recreate the board. `addBranch(frame)` now appends one normalized,
already-observed branch within the declared limit, returns its ordinary handle,
and preserves current focus. It performs no execution, observation, or engine
mutation.

Second, acquisition budgets and transformation bounds appeared as one noisy
`bounds differ` union despite having different key namespaces. Bound contrast
now reports separately:

- shared keys whose values differ;
- facts declared only by the left frame;
- facts declared only by the right frame;
- an explicit `no comparable keys` state.

Frame-level bounds remain unchanged and visible. No values are coerced into a
common stage vocabulary.

### Assessment

Trial 3 passes. It demonstrates that Field Board remains useful while branches
are added, inspected elsewhere, focused, and replaced—not only when a complete
field is reconstructed after the fact.

The feature set is now frozen except for concrete correctness defects. The board
remains a local position/comparison surface; it does not acquire, inspect
subjects, recommend branches, or absorb Evidence Desk.

## Trial 4: sustained composition with Evidence Desk

Three prospective real-relay voyages tested Field Board and Evidence Desk
together without importing either experiment into the other:

| Voyage | Commands | Field shape | Investigative exit |
| --- | ---: | --- | --- |
| Inquiry accounts | 21 | 180 notes → media, inquiry, links, inquiry authors | Note/account inspection and explicit profile hydration |
| Link domains | 18 | 160 notes → links, no-link notes, media, domain-count rows | Relation analysis and one schema-composed aggregate |
| Profile versus behavior | 18 | 41 accounts → NIP-05, interest words, sample, authored notes | Exact account inspection and bounded authored continuation |

All 57 controller commands succeeded. One Schema Composer call-shape mistake
occurred before execution and produced no hidden follow-up. The third voyage's
authored continuation returned an honest, non-exhaustive empty result and did
not become a negative account judgment.

The recurring transition was:

```text
Field Board position
→ unchanged note/account handle
→ Evidence Desk inspection
→ explicit operation
→ named handle plus already-requested summary
→ Field Board add or replace
```

Known movement, hydration, and relation analysis often bypassed the desk's full
action catalogue. Relation rows remained a deliberate exit to relation tools.
Schema Composer was useful only for unfamiliar aggregate construction.

The trials therefore support a narrow interchange convention rather than an
implementation dependency:

```text
board admission = named ordinary handle
                + already-requested summary
                + caller-defined reason

surface exit = unchanged ordinary handle
```

Remaining friction was factual and bounded: deeper derivation ancestry was
carried mainly by caller reasons, replacing a branch after hydration acted as a
manual frame refresh, and relation evidence-resolution counts required care not
to confuse them with row counts. None justified merging the two experiments.

The working tree was left unchanged by the voyages.
