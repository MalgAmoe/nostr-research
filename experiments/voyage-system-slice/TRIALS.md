# Voyage system slice trials

## Trial 1 — question-conditioned note and relation check

Date: 2026-07-30

Status: completed against real relays. Thirteen recorded controller operations
succeeded. The acquisition stopped at its declared distinct-event budget and
was correctly reported as partial.

### Setup

A fresh in-process declarative session and neutral controller used:

- `wss://nos.lol/`;
- `wss://relay.primal.net/`;
- 7-second timeout;
- 120 accepted-observation budget;
- 70 distinct-event budget;
- buffer capacity 400.

The navigator added this loose question before acquisition:

> Which weak visible signal has enough concrete evidence for one bounded
> follow-up?

No command was inferred from the question.

### Execution versus placement

The action gate explicitly executed `acquire` and returned a 70-event handle as
pending. At that point:

- Ground was absent;
- branch count remained zero;
- focus remained unavailable;
- no result had been placed.

A separate raw `show ... mode: summary` supplied the factual frame summary.
Only then did the navigator place the pending result as Ground. Ground placement
established the initial shared focus.

The same separation remained visible later:

| Result | Immediately after execution | Explicit decision |
|---|---|---|
| `slice-live-ground` | pending; no field position | place as Ground |
| `slice-live-note` | pending; focus still Ground | place as branch; focus still Ground |
| `slice-live-author` | pending; focus still chosen note | place as temporary focus |
| `slice-live-rows` | pending; focus still chosen note | place as temporary focus |
| `slice-live-media-check` | pending zero-row relation | discard from voyage |

Discarding the last handle issued no engine `release` command.

### Question-conditioned evidence choice

An explicit eight-item Ground preview opened the evidence lens. Visible
entrances included:

- two JSON-like `zone_presence` messages;
- several political statements;
- an account-seed disclosure-like post;
- a news-link post;
- crypto promotional text; and
- a payment-statistics post.

The navigator chose visible position 5, a note linking to a Daily Wire article,
because it offered one concrete external-link claim suitable for both evidence
inspection and structural relation analysis. The active question therefore
changed the movement: the navigator did not choose the first, loudest, or most
machine-like item.

The exact event reference and Ground handle were attached to the question with
caller-written reasons. The question received no status or synthesized answer.

### Evidence moments

The chosen one-note branch was focused explicitly. A separately requested
`details` outcome opened the evidence lens and showed:

- exact immutable event ID;
- one relay observation from `wss://nos.lol/`;
- current buffer resolution;
- one provenance observation;
- the complete bounded text excerpt and external URL.

Moving to the note author produced a pending account handle; placing it as
focus was separate. Its explicit evidence preview reported one unresolved
account with no current profile claims. The system did not hydrate it or treat
missing metadata as a negative finding.

Every lens close preserved the same shared focus. Focus was changed only after
the lens had closed.

### Relation moment

After returning focus to the note branch, the gate executed ordinary `relate`.
The one-row relation remained pending until explicitly placed as focus.

A raw relation preview plus raw contextual schema opened the relation lens. It
reported:

- one row and one subject;
- `event.author`, `event.text`, `event.links`, and `event.domains` as populated
  structural fields;
- `event.hasMedia: false`;
- buffer evidence resolution;
- the row's evidence and provenance counts.

The bounded row preview omitted two populated values, including the link/domain
arrays, and reported those omissions. The lens therefore established that the
fields were populated but did not claim their unavailable row values. An
additional project/explode operation would have been needed to inspect them.

A final explicit relation filter for `event.hasMedia == true` returned zero
rows. The navigator treated it as a momentary check and discarded it from the
voyage instead of creating an empty branch. The ordinary engine handle remained
available.

### Raw bypasses

Eight of the thirteen recorded controller commands used the direct raw escape:

| Explicit raw command | Why bypass was preferable |
|---|---|
| Ground summary | Pending Ground placement required an already-requested summary |
| Ground preview | Familiar evidence observation; no construction help needed |
| Chosen-note summary | Pending branch placement required an explicit summary |
| Chosen-note details | Familiar evidence observation |
| Author preview | Familiar account evidence observation |
| Relation preview | Relation lens needed already-observed rows |
| Relation schema | Relation lens needed already-observed field facts |
| Final status | Explicit end-of-trial condition check |

The gate was preferable for all five result-producing actions: `acquire`,
`pick`, `move`, `relate`, and `filter`. Raw bypass was therefore frequent but
role-specific rather than consistently preferable.

No raw bypass changed voyage position automatically. Raw outcomes affected the
system only when explicitly supplied to placement, a lens, or `notice()`.

### Conditions

The final explicitly requested status supplied:

- session revision 5;
- five engine handles;
- buffer pressure 17.5% (70/400 events);
- zero archive entries;
- zero notebook entries and memberships.

The acquisition condition retained its declared partial status and
`distinct-event-budget` bound. Both relays opened and subscribed; the budget
stopped the attempt before relay completion. No exhaustiveness claim was made.

Catalogue staleness remained true because no catalogue synchronization was
requested. This was honest but not useful during this voyage.

### Position and attention

The final compact voyage state recovered without external structure notes:

- Ground: 70 acquired kind-1 events;
- branch: one question-conditioned note;
- shared focus: one relation handle outside the field;
- one live question with Ground and exact-event references;
- no active lens;
- no staged command;
- no pending result.

There was no competing Home/current/trail state. “Outside field” accurately
described a temporary relation focus without silently admitting it as a
branch.

### Command trace

The thirteen recorded operations were:

```text
acquire
show
show
pick
show
show
move
show
relate
show
schema
filter
status
```

No command failed. No automatic follow-up or retry occurred.

### Defects and friction

1. **External-attempt strip was too large.** The first live output retained much
   more acquisition structure than a small condition strip needs. The
   projection was reduced to status, reached bounds, selected observation
   counts, compact relay-attempt counts, and scope. No new observation was
   introduced.
2. **Pending frame placement requires a raw summary.** Because the gate blocks a
   second result-producing action while a result is pending, Ground/branch
   summaries were requested through the raw escape. This was explicit and
   understandable, but it is repeated ceremony to watch in later voyages.
3. **Generic relation rows may omit the value that motivated the check.** The
   schema established populated link/domain fields, but the bounded row did not
   expose their values. The lens reported the omission correctly; a deliberate
   relation projection would be required.
4. **Unresolved profile evidence is thin but honest.** The account lens had no
   claims without explicit hydration. The system offered no shortcut.
5. **Catalogue staleness was continuously visible but inert.** It did not affect
   a decision in this trial.
6. **Trial-process cleanup was not observed.** The complete trial record was
   emitted, but the Node process did not exit within the following ten seconds
   and was terminated. Whether the wait was controller close or remaining
   relay runtime state was not established. The thirteen-operation research
   transcript had already completed; this is retained as a runner/runtime gap,
   not assigned to the slice without further evidence.

### Research effect

The arrangement changed one research decision: the loose question selected the
concrete external-link note from several louder machine and political signals.
It also made two non-decisions explicit:

- unresolved author metadata did not justify hydration or judgment in this
  bounded trial;
- the empty media check did not deserve field placement.

The slice did not answer whether the linked article was accurate, whether its
author was automated, or whether the sampled field was representative.

### Provisional finding

The first slice preserved one focus and made execution-versus-placement
unmistakable across event, account, and relation moments. Evidence and relation
lenses were distinct and understandable. The most important friction was not
missing routing; it was the repeated explicit summary needed to turn a pending
handle into a factual field frame.

One voyage is insufficient to establish the broader voyage-system hypothesis.
Collection, comparison, branch replacement under live pressure, and several
simultaneous loose questions remain untested in sustained real research.

---

## Trial 1 process-exit isolation

Date: 2026-07-30

Status: reproduced and isolated. No engine, controller, session, relay, or voyage
layer defect was found.

The original Trial 1 process emitted its complete result but remained alive
until terminated. Five minimal probes separated the possible owners.

### Probe results

| Probe | Real relay activity | Explicit close | Result |
|---|---|---|---|
| Raw platform `WebSocket` | Opened and closed `wss://nos.lol/` | `WebSocket.close()` | `beforeExit` at 253 ms; exit 0 |
| Declarative session | Acquired 8 events | `session.close()` | close resolved at 300 ms; `beforeExit` at 344 ms; exit 0 |
| Neutral controller | Acquired 8 events | `controller.close()` | controller state `closed` at 291 ms; `beforeExit` at 357 ms; exit 0 |
| Voyage slice | Staged/acquired 8 events, then explicitly discarded pending | `controller.close()` | close resolved at 263 ms; `beforeExit` at 320 ms; exit 0 |
| Interactive runner only | No engine, controller, relay, or voyage | closed `readline.Interface` | remained alive beyond 5 seconds |

The interactive-only reproduction used a piped `process.stdin` held open by the
persistent-process harness. After `readline.close()`, `process.stdin.isPaused()`
was true, but the process still had the pipe sockets as active handles and did
not reach `beforeExit`.

A second runner-only probe added:

```js
process.stdin.pause();
process.stdin.unref?.();
```

It exited with code 0 immediately after consuming the choice. The same narrow
runner cleanup was used by the Voyage 2 and partial Voyage 3 disposable runners;
Voyage 2 then exited normally after `controller.close()`.

### Finding

The Trial 1 problem belonged to the disposable interactive runner's piped stdin
lifetime. It was not caused by:

- `controller.close()`;
- `session.close()`;
- acquisition WebSocket lifetime;
- the voyage-system layer; or
- retained engine handles.

There is no public engine/controller defect to fix for process exit. No
repository runtime code was changed. Future disposable interactive runners need
to close and unreference their piped input after the final response.

---

## Voyage 2 — three-question relation field

Date: 2026-07-30

Status: one construction attempt failed and was abandoned; a fresh sustained
voyage then completed. No automatic retry occurred.

### Failed construction attempt

The first disposable runner supplied `limit: 1600` to `explode`. The public
operation rejected it with:

```text
INVALID_OPERATION: limit must be an integer from 1 to 1000.
```

The gate correctly retained no pending handle for the failed operation. The
runner then incorrectly assumed pending existed and raised a local TypeError.
That session was abandoned. The limit error was navigator-side command
construction, and the null-pending error was runner logic; neither was assigned
to the slice or engine. The sustained voyage began in a fresh session with an
explicit 1000 bound.

### Ground and questions

A fresh acquisition retained 180 kind-1 events from a three-relay attempt:

- 212 accepted observations;
- 32 duplicate observations;
- 121 distinct visible authors;
- acquisition stopped at the 180 distinct-event budget;
- status remained partial and non-exhaustive;
- two of three attempted relays were reported opened and subscribed.

Three loose questions coexisted from before acquisition through exit:

1. Which recurring tag creates a bounded subject branch worth retaining?
2. Which external domain recurs enough to deserve an evidence branch?
3. Which mentioned account creates a concrete neighborhood to inspect?

All three referred to the same Ground handle. They had no priorities, statuses,
or synthesized answers.

### Relation progression

An explicit `relate` result became temporary focus, not a branch. The voyage
then used ordinary relation operations.

#### Tags

```text
relate
→ explode event.tags
→ filter tag.0 == "t"
→ aggregate by tag.1
→ sort by occurrences descending
```

The sorted relation contained 39 tag groups. The visible leaders included:

- `constitute`: 14 occurrences;
- `solana`: 12;
- `freelance`: 12;
- `usdc`: 12; and
- several other 12-occurrence tags attached to the same visible Micro
  Freelance Toolkit text.

Question 1 caused the navigator to choose `constitute`, the highest recurring
but unfamiliar tag, rather than one of several redundant campaign terms. A
filter/extract sequence recovered 14 exact events, all from one visible author.
The abstract `tag-groups` branch was explicitly replaced by a 14-event
`tag-notes` branch. An evidence lens showed the first eight JSON-like
`zone_presence` notes without classifying their purpose or origin.

#### Domains

```text
explode event.domains
→ aggregate by domain
→ sort by occurrences descending
```

The sorted relation contained 27 domain groups. Visible examples included:

- `rwatimes.io`: 19 occurrences;
- `column-secretary-acne-arbor.trycloudflare.com`: 12;
- `github.com`: 12;
- `image.nostr.build`: 5;
- `files.catbox.moe`: 5; and
- two domains with 2 occurrences each.

Question 2 caused the navigator to choose `rwatimes.io` because its sampled
texts varied across tokenized-asset news rather than repeating one identical
campaign. Nineteen concrete events from seven visible authors replaced the
abstract `domain-groups` branch as `domain-notes`.

A later `occurrences >= 2` check returned 10 domain rows. It informed the
question but duplicated the retained domain evidence, so its pending handle was
explicitly discarded from voyage state without engine release.

#### Mentions

Explicit `p` tags produced 29 mentioned-account groups. Three accounts appeared
twice; the remaining visible groups appeared once. Question 3 selected:

```text
ee6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74
```

Its two sampled mention contexts discussed Nostr adoption and a web app. The
exact account was attached to the question, extracted as an ordinary account
handle, and inspected through the evidence lens. It remained unresolved; no
profile claim, identity conclusion, or hydration was inferred.

### Branch evolution and focus

The field evolved from three abstract relation branches:

```text
tag-groups · 39 rows
domain-groups · 27 rows
mention-groups · 29 rows
```

into:

```text
tag-notes · 14 events
domain-notes · 19 events
mention-groups · 29 rows
```

Both replacements required this explicit sequence because pending placement
has no replacement destination:

```text
execute extract
→ result pending
→ raw summary
→ place pending as focus
→ replace existing branch with that already-observed handle
```

This was coherent but ceremonious. It also made the replacement focus explicit:
a direct branch replacement alone would not have moved focus.

The final focus was the older 27-row domain ranking handle outside the field,
after the auxiliary threshold result was discarded. The snapshot described
that accurately as `outside-field`, but returning to an analytical source after
replacing its branch made the field/focus relationship less intuitive.

Question references continued to point to the original ranking handles after
the field branches were replaced by concrete subjects. This retained the
question's decision evidence, but created two parallel histories: current field
position and older question evidence.

### Pending decisions

Every successful result-producing command first appeared as pending. The
voyage made 19 explicit result-placement decisions:

- Ground placement once;
- branch placement three times;
- temporary focus placement for intermediate relations and extracted subjects;
- focus-then-branch replacement twice; and
- one explicit discard of a 10-row auxiliary check.

No result entered a branch or focus at execution time.

### Raw bypasses and repeated ceremony

The successful voyage executed 36 controller commands:

- 19 result-producing actions through the gate;
- 17 direct raw commands.

Raw use consisted of:

- six summaries required for Ground, branch admission, or replacement;
- five relation previews;
- five relation schemas; and
- one final status.

Three relation branches each needed both a placement summary and a later
preview, producing two separate `show` commands for the same handle. The
summary was mandatory frame ceremony; the preview was needed for a useful
relation lens. Familiar `show`, `schema`, and `status` operations were always
clearer through raw escape than through staging.

### Conditions

Final explicitly observed conditions were:

- revision 19;
- 19 engine handles;
- buffer pressure 25.7% (180/700);
- zero archive entries;
- zero notebook entries or memberships;
- acquisition partial at the distinct-event bound; and
- catalogue stale `true` because synchronization was never requested.

Catalogue staleness did not affect a decision. Buffer/archive/notebook pressure
mattered only at exit, not continuously. The latest receipt reflected the
explicit final status rather than the last research transition.

### Did questions matter?

Yes, but only because the navigator used them deliberately:

- the tag question selected unfamiliar `constitute` recurrence over several
  redundant campaign tags and caused branch replacement with exact events;
- the domain question selected varied `rwatimes.io` evidence and caused a
  second branch replacement;
- the mention question selected one exact account from tied recurrence counts
  and caused account evidence inspection.

Without those prompts, the three ranking relations would have been equally
plausible stopping points. The questions did not choose values, rank rows, or
produce conclusions themselves.

### Voyage 2 finding

The relation lens was understandable for three-field aggregate rows and the
shared focus survived every transition. The useful composition was question →
mechanical relation → explicit subject extraction → evidence lens. The main
cost was repeated pending-focus placement for every intermediate relation and
six mandatory summaries that did not themselves answer a research question.

---

## Voyage 3 — comparison and collection halted by public defect

Date: 2026-07-30

Status: **halted before collection** under the instruction to stop on a
demonstrated public-boundary defect. No workaround or engine/controller change
was attempted.

### Progress before halt

A fresh real-relay voyage successfully:

1. acquired and placed a bounded kind-1 Ground;
2. derived media-bearing events through `relate → filter → extract`;
3. derived external-domain events through `explode → extract`;
4. placed both concrete sets as branches;
5. executed ordinary `compare` with the media set as left and domain set as
   right;
6. received a normal pending summaries handle;
7. explicitly placed the compare result as shared focus; and
8. explicitly requested a successful preview of the compare result.

The compare handle was ordinary and usable:

```text
id: v3-media-link-compare
kind: summaries
count: 1
```

The preview command succeeded. To test whether the existing relation lens was
sufficient without adding a comparison lens, the navigator explicitly requested
contextual schema for that same compare handle. It failed with:

```text
INTERNAL_ERROR: The command could not be completed.
```

Because the relation lens accepts only successful already-observed outcomes, it
correctly rejected the failed schema outcome. The voyage stopped. Intersection,
difference, union, evidence selection, notebook judgment, membership, and
archive preservation were not executed in the halted session. Their sufficiency
therefore remains untested by Voyage 3.

### Minimal public-boundary reproduction

The failure reproduced without real relays and without the voyage layer:

1. ingest two valid fixture events;
2. `select` one as `left`;
3. `select` both as `right`;
4. `compare left` with `right` as `comparison`;
5. `show comparison` — succeeds with `type: "typed-collection"`;
6. `schema comparison` — fails with `INTERNAL_ERROR`.

The exact public results were:

```text
select left       ok true · events · 1
select right      ok true · events · 2
compare           ok true · summaries · 1
show comparison   ok true · typed-collection
schema comparison ok false · INTERNAL_ERROR
```

This is an engine/session public-boundary correctness defect: an ordinary
successful handle accepted by `show` causes contextual `schema` to return an
internal error instead of a factual schema or a semantic unsupported-operation
response. It is not caused by controller correlation, relay state, the voyage
system, or lens projection.

No engine/controller code was changed. Evaluation stopped rather than omitting
the schema observation or routing comparison through an invented lens.

### Raw bypasses before halt

Five raw commands had occurred:

- Ground summary;
- media-branch summary;
- external-domain-branch summary;
- compare preview; and
- compare schema, which exposed the defect.

All result-producing operations before the halt used the gate and remained
pending until explicit focus or branch placement.

---

## Hard cost assessment after the extended evaluation

The implementation remains 1,052 source lines. That is too large for the amount
of behavior supported by sustained evidence.

### Approximate code allocation

| Area | Lines | Evidence assessment |
|---|---:|---|
| Main state/API and transitions | 18–426 (~409) | Core portions repeatedly used |
| Text formatter | 428–500 (~73) | Used for exit snapshots, not decision-making during voyages |
| Frame and lens normalization/projection | 502–713 (~212) | Show-based evidence and real relation rows used; broader cases weak |
| Execution, condition, handle, and reference helpers | 715–920 (~206) | Gate/receipt/handle paths used; several variants untested |
| Lens formatting and generic bounding/helpers | 922–1052 (~131) | Necessary for current implementation shape, but high incidental cost |

### Genuinely used and supported

Across Trials 1–2 and the partial third voyage, the following earned their
place behaviorally:

- staged unchanged commands and explicit single execution;
- successful handle retained as pending with no automatic placement;
- explicit Ground, branch, focus, and discard destinations;
- one shared focus, including honest `outside-field` focus;
- branch replacement that does not silently change focus;
- multiple loose questions with caller-written handle/subject reasons;
- one evidence or relation lens consuming explicit observations;
- evidence preview/details for event and unresolved-account moments;
- relation preview plus schema for ordinary relation handles;
- raw controller escape;
- explicit condition intake through `notice()`;
- final compact position/question/pending snapshot; and
- status-derived handle, buffer, archive, and notebook counts.

These behaviors changed actual decisions in Voyage 2 and kept execution versus
placement unambiguous.

### Implemented but unsupported by sustained voyage evidence

The following public/state behaviors are implemented but have no sustained live
support, or only fixture-test contact:

- direct `establishGround()` rather than pending Ground placement;
- direct `addBranch()` and `removeBranch()`;
- `unstage()`;
- successful exact-subject focus;
- live question detachment/removal;
- evidence lenses built from `inspect` or `explain` rather than `show`;
- transport-failure retention and retry behavior;
- warning and partiality variants beyond acquisition/status facts;
- limits and error paths for many branch/question/reference combinations;
- comparison through either existing lens;
- notebook/archive evidence after collection;
- collection commands through the gate in a sustained voyage; and
- formatter usefulness while a lens is open or a result is pending.

The evidence detail projection also does not currently retain the
`notebookEntry` field present in detailed engine evidence. Voyage 3 stopped
before this could be tested live, so the current evidence lens cannot yet be
claimed sufficient for post-collection review.

### Projection and state costs not justified yet

- Generic bounded cloning, omission accounting, and many nullable evidence
  fields occupy substantial code while live choices relied on a much smaller
  subset: IDs, text, counts, resolution, a few relation values, and provenance.
- Relation schema projection worked for ordinary relations but the attempted
  compare composition exposed an engine defect before its value could be shown.
- The condition strip was mainly an exit report. Catalogue staleness was unused
  in both sustained voyages; pressure was consulted only after explicit status.
- Question references and field branches can retain different historical
  handles after replacement. This is factual but increases the state a
  navigator must reconcile.
- Every temporary relation result required pending focus placement before the
  next gated command. That made the state machine visible, but much of the 19
  transition sequence was ceremony rather than research orientation.
- Ground/branch frame validation forced six summaries in Voyage 2, including
  summaries immediately followed by previews of the same handles.

### Hard disposition

**Do not retain the 1,052-line implementation unchanged. Simplify it before any
feature expansion.**

The concept should not yet be discarded: Voyage 2 demonstrated that one focus,
three loose questions, evolving branches, pending placement, and distinct
relation/evidence moments can alter research choices without hidden commands.
But the current implementation cost is not justified by the supported surface.

A future simplification should be judged by subtraction, not by adding missing
comparison or collection UI. If the proven gate/field/question/lens loop cannot
be preserved while removing unsupported methods, broad projections, repeated
condition machinery, and formatter complexity, the experiment should be
discarded rather than promoted.

Further comparison/collection evaluation is blocked on the public contextual
schema defect for compare-result handles. Per instruction, that defect is
reported here without a fix.

---

## Consolidation and resumed comparison/collection voyage

The first implementation was reduced from 1,052 to roughly 880 source lines before the
blocked voyage resumed. The reduction preserved the proven loop while removing
unearned alternatives:

- all Ground and branch entry now passes through pending-result placement;
- summaries are optional frame evidence rather than placement ceremony;
- branch replacement is one explicit pending destination;
- focus is handle-only;
- evidence lenses consume `show`; relation lenses consume `show` and `schema`;
- conditions use explicit receipts, warnings, and status pressure; and
- generic deep projection and unused catalogue-state machinery were removed.

The engine defect was also corrected at its actual boundary. A contextual
`schema` request for a typed `summaries` collection now reports its structure
and no compatible operations instead of assuming every collection item has a
Nostr subject.

### Resumed live result

A fresh 120-note field produced these caller-chosen sets:

| Set | Count |
|---|---:|
| Media-bearing notes | 18 |
| External-domain notes | 55 |
| Intersection | 18 |
| Media-only difference | 0 |
| External-domain-only difference | 37 |
| Union | 55 |

The navigator replaced the broad external-domain branch with its 37-note
right-only difference and explicitly discarded the redundant union. One exact
note was then selected, remembered, preserved as an excerpt, and added to a
named membership. The final state contained one notebook note, one membership,
one archived excerpt, 12 engine handles, and 24% buffer pressure.

Three loose questions remained useful throughout and changed concrete choices.
No comparison-specific lens or voyage-owned collection model was needed.
Collection therefore remains engine-owned.

### One gate defect found and corrected

Successful `remember` and `preserve` commands without a `resultId` return
unnamed result metadata such as `{ "kind": "events", "count": 1 }`. The action
gate incorrectly treated that metadata as a reusable handle and threw after the
engine mutation had already succeeded.

The gate now creates pending state only for successful handles with a non-empty
`id`. Successful unnamed mutation results complete normally with no pending
placement. A public-boundary voyage test preserves evidence without a
`resultId`, verifies that execution succeeds, and verifies the archive mutation.

### Remaining observations, not feature requests

- The evidence lens omits `notebookEntry`, while raw detailed evidence exposes
  it. Raw evidence remains the explicit exit for post-collection review.
- Receipt-led conditions describe the latest noticed outcome; later receipts do
  not retain earlier acquisition context.
- Summary-free frames honestly lack bounds, completeness, and resolution facts
  until the navigator explicitly observes them.
- Exact-subject work requires an ordinary one-subject handle before it becomes
  shared focus.

These are current boundaries to test through further use, not reasons to expand
the experiment now.

---

## Hybrid raw/gate rhythm trials

Date: 2026-07-31.

These trials tested a caller convention without changing the experiment:

- **transient** result-producing transformations execute through the raw
  controller;
- **candidate** results that may become Ground, a branch, or focus execute
  through the action gate;
- **observations** such as `show`, `schema`, and `status` remain raw.

The question was whether this division removes temporary-placement ceremony
without losing voyage orientation.

### Voyage 1 — relation-heavy domain room

A 240-note random field was transformed through seven raw transient stages:
`relate`, domain expansion, aggregation, sorting, filtering, another relation,
and author aggregation. Only two results used the gate:

- Ground; and
- the extracted concrete domain room.

Four raw observations supported decisions. The navigator selected
`assets.twitch.tv` from the bounded recurrence table: 14 domain rows distributed
evenly across two visible authors, seven each.

Ground and the concrete room remained legible while every intermediate relation
was allowed to disappear from voyage state. No transient result later needed
placement. This is the strongest evidence for the hybrid convention.

One first attempt used `event.id` instead of the schema-exposed `subject.id` for
extraction. The engine rejected it with the available fields. This was a
recoverable operator error, not an engine or voyage defect; raw speed does not
remove the need for contextual schema when a field is unfamiliar.

Command distribution:

| Category | Count |
|---|---:|
| Candidate | 2 |
| Transient | 7 |
| Observation | 4 |

### Voyage 2 — evidence descent

A 180-note Ground led through a chosen note, its author, and hydrated profile
evidence. All four result-producing commands used the gate because each result
was expected to remain part of the evidence path. Four observations remained
raw.

The airlock selection initially looked conversational, but hydration identified
the author as a tracking-token removal bot. The second question therefore
complicated the first impression rather than confirming it. Ground, note,
author, and profile were appropriate durable positions; no transient pipeline
was present, so the hybrid convention naturally reduced to ordinary gated
descent.

Command distribution:

| Category | Count |
|---|---:|
| Candidate | 4 |
| Transient | 0 |
| Observation | 4 |

### Voyage 3 — speculative sensory-life probe

A 220-note Ground was scanned for ordinary sensory-life language. `relate` and
the first scan were classified as transient. The scan returned five matching
rows, so the supposedly disposable result unexpectedly became a branch
candidate.

Because the current experiment only places pending gated results, the identical
scan had to be executed a second time through the gate. This was the one
unexpected promotion across the three voyages.

Command distribution:

| Category | Count |
|---|---:|
| Candidate | 2 |
| Transient | 2 |
| Observation | 3 |
| Unexpected promotions | 1 |

### Conclusion

The hybrid rhythm is useful as a caller convention:

- transient relation pipelines no longer require repeated focus placement;
- durable evidence descents still receive explicit execution and placement;
- observations remain cheap and direct;
- Ground, questions, branches, and shared focus retain their navigational role.

One unexpected promotion is real friction but does not yet justify a new
operation. A local `adoptNamedHandle`-style action would be warranted only if
repeated voyages show this pattern recurring. Until then, the visible duplicate
execution is less costly than adding another lifecycle path.

Retain the simplified experiment without code changes. Use the hybrid rhythm in
future voyages and keep counting unexpected promotions.

---

## Relay Confessional

Date: 2026-07-31.

Research question:

> How different is the bounded kind-1 universe depending on which relay we dock
> at?

The voyage acquired the exact same filter separately from nos.lol, Primal, and
Snort:

```text
kinds: [1]
until: 1785450490
limit: 180
```

Every acquisition explicitly named one relay. Ground and the other two relay
fields were durable voyage positions. Pairwise comparisons, temporary unions,
intermediate intersections, relation entry, and author aggregation remained raw
transient operations. The all-relay intersection and the three bounded
relay-exclusive fields became explicit branches.

### Acquisition facts

| Relay | Accepted distinct events | Terminal outcome | Content-warning exclusions |
|---|---:|---|---:|
| nos.lol | 180 | distinct-event budget | 0 |
| Primal | 179 | EOSE | 1 |
| Snort | 178 | EOSE | 2 |

Every acquisition reported `exhaustive: false` and the same uncertainty: a
bounded attempt was made; relay completeness is not implied.

### Identity overlap

Pairwise comparisons:

| Pair | Left | Right | Shared | Left only | Right only |
|---|---:|---:|---:|---:|---:|
| nos.lol / Primal | 180 | 179 | 45 | 135 | 134 |
| nos.lol / Snort | 180 | 178 | 36 | 144 | 142 |
| Primal / Snort | 179 | 178 | 61 | 118 | 117 |

Only 12 event identities appeared in all three bounded fields.

After subtracting the union of the other two fields:

| Bounded exclusive field | Events |
|---|---:|
| nos.lol observations only | 111 |
| Primal observations only | 85 |
| Snort observations only | 93 |

These are **sample-relative differences**, not claims that an event is absent
from a relay's corpus. Each relay may select or order the same limited filter
differently, and later or broader acquisition could resolve more overlap.

### Concentration differed visibly

The most prolific author inside each bounded exclusive field contributed:

| Field | Top-author events | Field size |
|---|---:|---:|
| nos.lol only | 4 | 111 |
| Primal only | 30 | 85 |
| Snort only | 52 | 93 |

The next visible Primal concentrations were 10 and 7 events; the next visible
Snort concentrations were 6 and 5. The nos.lol preview was much more diffuse,
with several authors at three events.

This is a mechanical author-concentration observation. It does not establish
bot status, relay policy, quality, or intent. The note previews did, however,
make the different bounded rooms tangible: ordinary prose, automated weather,
game-state JSON, crypto promotion, news automation, repeated search-link
templates, media posts, and genuine conversation were distributed differently.

### Voyage-system assessment

Command distribution:

| Category | Count |
|---|---:|
| Candidate | 8 |
| Transient | 16 |
| Observation | 14 |

The hybrid rhythm worked especially well:

- all three docking fields, the common set, the three exclusive sets, and one
  exact specimen were durable positions;
- 16 intermediate set and relation transformations did not clutter voyage
  state;
- questions retained the distinction between overlap, exclusive character, and
  epistemic caution;
- seven of eight branch slots were used, but the field remained recoverable;
- 407 canonical events represented 537 accepted observations at exit, with no
  buffer eviction.

No transient result unexpectedly required promotion. No engine or experiment
defect appeared.

### Conclusion

The bounded universe visibly changed with the docking point. The strongest
finding is not that one relay "has" particular content, but that a small recent
window from one relay is a poor proxy for the Nostr field. Multi-relay contact
is therefore epistemically useful even when research deliberately remains
small and sequential.

Relay Confessional is also a natural use of the simplified voyage system:
parallel durable fields, explicit set differences, and raw transient analysis
fit together without requiring a new relay-specific interface.
