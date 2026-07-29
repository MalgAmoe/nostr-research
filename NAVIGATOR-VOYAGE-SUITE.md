# Navigator voyage suite

Status: completed experimental protocol for testing the first
navigator-facing arrangement. All six voyages ran on 2026-07-29.

## Purpose

This suite tests whether the caller-side arrangement helps different research
postures while preserving navigator control. It tests movement, senses,
judgment, collection, and lifecycle as coupled practices rather than testing
topics or searching for predetermined answers.

The direct CLI and neutral-controller voyages in
[VOYAGE-TRIALS.md](./VOYAGE-TRIALS.md) are the baseline. No additional
unarranged baseline voyage is required.

## Shared protocol

Each voyage:

- starts from a bounded random field unless its posture requires an existing
  anchor;
- uses the same relay set and broadly comparable acquisition bounds;
- proceeds sequentially: observe, decide, then execute one visible operation;
- keeps the arrangement unchanged during the voyage;
- records navigator judgment when it occurs; and
- stops when its objective is reached, its budget is reached, available
  branches are exhausted, or the navigator explicitly abandons it.

The arrangement hypothesis is:

> Arranged controls should reduce invalid commands and schema guessing without
> concealing operations, choosing routes, or encouraging premature conclusions.

For every voyage record:

- commands and contextual-schema consultations;
- invalid command attempts;
- control groups used;
- decisions made from receipts alone;
- decisions requiring summary, preview, coverage, details, or explain;
- handles created, replaced, and released;
- navigator judgment points;
- repeated command-construction friction;
- missing or badly arranged information;
- bounds, partiality, and dead branches;
- notebook and archive actions;
- exit reason; and
- differences from the baseline voyages.

Correctness defects may be fixed immediately after a voyage. Ergonomic changes
normally require the same friction to appear in at least two voyages.

## Voyage 1: thread descent

Intent: determine whether one random note can lead to an understandable
conversation and its surrounding identities.

Possible movement includes replies, ancestors, quotes, mentions, referenced
events, referenced accounts, and author profiles.

This tests event-to-event navigation, local versus relay continuation,
thread completeness and partiality, relationship explanations, transitions
between notes and accounts, and route legibility.

Exit when one coherent thread and its principal identities are understood, no
productive route remains, or 30 research commands are reached.

## Voyage 2: media trail

Intent: follow media evidence from random notes toward its sources and
publishers.

Possible movement includes media-bearing notes, attachment explosion,
media-family filtering, domains, links, authors, profiles, and authored
histories.

This tests relation-heavy analysis, declared versus inferred attachments,
transitions from media facts to account evidence, changing observation needs,
analysis-control density, and evidence continuity. Unlike the earlier media
trial, the focus is movement between representations rather than media
classification itself.

Exit when three meaningfully different media trails are understood, media
evidence cannot connect to useful subjects, or 35 commands are reached.

## Voyage 3: weak-signal pursuit

Intent: pursue a subject represented by only a small part of the random field
while resisting dominant activity.

Possible movement includes small text matches, tags, linked domains, authors,
mentions, references, and set comparison or subtraction. The navigator records
why the signal was chosen before following it.

This tests small and zero-result visibility, escape from dominant subjects,
branch comparison, recovery from dead routes, absence of hidden popularity
logic, and delicate exploration.

Exit when a small coherent cluster is found, three plausible branches fail,
the signal collapses into the dominant cluster, or 40 commands are reached.

## Voyage 4: contradiction and rejection

Intent: test whether the arrangement supports revising an initial impression
rather than merely confirming it.

Before investigation the navigator records the subject, initial positive
impression, supporting evidence, and remaining uncertainty. The voyage then
deliberately seeks authored history, repetition, automation, conflicting
profile evidence, replies, reactions, references, affiliations, and
alternative relay or temporal evidence where available.

This tests judgment tempo, access to earlier evidence, disconfirming movement,
notebook/archive separation, and whether compact observations encourage
premature conclusions.

Exit when the impression is explicitly strengthened, weakened, or left
uncertain; relevant contradictory routes are exhausted; or 30 commands are
reached.

## Voyage 5: account depth

Intent: understand one account sufficiently to treat it as an explainable
anchor or reject it.

Possible movement includes random notes to authors, profile hydration, authored
notes, references, follows or followers where meaningful, and second-ring
profiles.

This tests repeated collection/relation transitions, hydration visibility,
immutable metadata versus current profiles, echo-chamber gravity, sustained
handle lifecycle, and qualified anchor judgment.

Exit when an account becomes an explainable anchor, is rejected or remains
uncertain, two navigation rings are completed, or 40 commands are reached.

## Voyage 6: collection voyage

Intent: collect five explainable profiles connected to a caller-chosen subject
with supporting evidence for every inclusion.

Every profile needs an explicit inclusion reason and evidence beyond profile
claims. Supporting evidence is deliberately preserved, rejected candidates
remain distinct, and the goal changes only through an explicit recorded
decision.

This tests integration across movement, senses, judgment, collection, branch
management, handle lifecycle, notebook/archive responsibilities, and whether a
coherent vessel posture begins to emerge.

Exit when five supported profiles are collected, the field cannot responsibly
support five, handle or evidence pressure prevents continuation, or 60 commands
are reached.

## Run order

1. Thread descent
2. Media trail
3. Weak-signal pursuit
4. Contradiction and rejection
5. Account depth
6. Collection voyage

## Results

Results are appended after each completed voyage without rewriting its
pre-registered intent, tests, or exit conditions.

### Voyage 1 result: thread descent

Status: completed on 2026-07-29.

The voyage acquired a random 250-event kind-1 field and reached the configured
distinct-event budget. A 12-event preview supplied the first judgment-bearing
sense. The navigator chose one short apparent reply, then requested details
rather than assuming its thread role. Its raw evidence contained one `e`
reference and one `p` reference.

Local ancestor continuation resolved the referenced parent already present in
the buffer. Explicit relay-backed reply continuation completed without a
request bound and returned the chosen reply as the only observed child of that
parent. Coverage, preview, and an explicit membership explanation preserved
the distinction between:

- the exact two canonical events;
- the typed reply-parent and reply-root evidence;
- the bounded relay attempt; and
- the absence of any claim about a globally complete conversation.

The parent was a promotional Bitcoin headline from `Green Candle Investments`.
The reply was a generic affirmation from `imad gaza`. Hydrating both accounts
and acquiring a balanced 24-note authored-history window changed the thread
from an isolated exchange into an understandable pattern:

- the parent account repeatedly published emphatic Bitcoin headlines and
  rhetorical questions; and
- the reply account repeatedly posted generic engagement responses, sometimes
  redirecting readers to a pinned Gaza solicitation.

The navigator recorded both accounts as `uninterested` for this voyage with
separate attributed reasons. This was not an engine classification. The exact
two-event thread was preserved canonically as the evidence supporting those
judgments.

#### Measurements

- Research commands: 30 from acquisition through corrected preservation,
  excluding initial configuration and final `list`/`status`.
- Contextual schema consultations: 4—broad field controls, `continue`, `union`,
  and `preserve`.
- Invalid commands: 1. The first `preserve` supplied a string reason where the
  contract requires a typed reason object. It failed without mutation; focused
  schema made the correction constructible.
- Control groups used:
  - contact: `continue`, `hydrate`;
  - movement: `pick`, `union`, `move`;
  - judgment: `remember`;
  - collection: `preserve`;
  - lifecycle: final explicit `list` and `status`;
  - analysis: none.
- Explicit senses:
  - preview: 5;
  - summary: 1;
  - coverage: 1;
  - details: 1;
  - explain: 1.
- Receipt-only decisions: 4 mechanical decisions to inspect or continue after
  successful handle creation; no interpretive or judgment decision relied on a
  receipt alone.
- Handles at exit: 13; the bounded catalog showed 6 and reported 7 omitted.
- Transcript before close: 33 entries and 69,235 bytes, with no omissions.
- Observation buffer: 296 resident events at 42.3% pressure, no evictions, and
  no omitted observations.
- Archive: 2 canonical events.
- Notebook: 2 attributed judgments.
- External partiality:
  - initial field acquisition reached the distinct-event budget;
  - participant authored history reached event and distinct-event bounds;
  - reply continuation itself reported a complete bounded attempt.
- Exit reason: the thread and its principal identities were understood at the
  30-command budget.

#### Arrangement findings

The grouped controls made the available thread routes legible, and the focused
`continue` contract kept local and relay sources explicit. Observation panels
kept bounds and completeness beside the evidence while allowing the navigator
to choose preview, details, coverage, or explanation deliberately.

The arrangement did not prevent the preservation error because the navigator
did not request that focused contract before constructing the command. This is
the first concrete command-construction friction in the suite. It should not
produce a convenience command yet; the suite requires repeated evidence.

No correctness defect or missing engine primitive was found. The next voyage
keeps the arrangement unchanged.

### Voyage 2 result: media trail

Status: completed on 2026-07-29.

A random 300-note field contained 25 media-bearing notes. Relating the field,
filtering factual `event.hasMedia`, exploding normalized attachments, then
exploding their media-family arrays produced:

- 26 image-family attachment observations;
- 5 unknown-family observations; and
- 2 video-family observations.

The navigator extracted representative event subjects from all three families
and preserved five exact notes. They exposed meaningfully different trails:

- inferred media from an ordinary image URL in a Spanish crypto-news post;
- a live-stream announcement combining an image with an external stream link;
- a declared mixed image/video attachment set in crypto analysis;
- an inferred YouTube video shared as a terse personal post; and
- an image plus incomplete/unknown attachment evidence in a Thai book-club
  post.

Moving from these media events to authors, hydrating profiles, and acquiring a
balanced authored-history window separated five different publishing
postures: a Nostr developer sharing personal links, a live-stream marketplace
announcer, a crypto-analysis publisher, a Thai individual discussing books,
and an automated-looking Spanish crypto-news feed. The engine exposed facts;
the navigator supplied these contextual descriptions.

#### Measurements

- Research commands: 32 through preservation, excluding configuration and
  final `list`/`status`.
- Contextual schema consultations: 5—relation filtering, attachment explosion,
  attachment filtering, aggregation, and extraction.
- Invalid commands: 2. One aggregate used guessed `{as, op}` fields instead of
  the contract's `{name, operation}` fields. The immediate attempted `show`
  then failed because the aggregate handle did not exist. Both failures left
  state unchanged.
- Control groups used:
  - contact: `hydrate`, `continue`;
  - movement: `extract`, `union`, `move`;
  - analysis: `relate`, `filter`, `explode`, `aggregate`;
  - collection: `preserve`;
  - lifecycle: final `list` and `status`;
  - judgment: none.
- Explicit senses:
  - preview: 5 successful uses;
  - summary: 1;
  - details: 1;
  - coverage and explain: none.
- Receipt-only decisions were mechanical checks of successful cardinality;
  media interpretation always used preview, details, or contextual fields.
- Handles at exit: 18.
- Transcript before close: 35 entries and 88,023 bytes, with no omissions.
- Observation buffer: 340 events at 42.5% pressure, no evictions, and no
  omitted observations.
- Archive: 5 canonical events.
- Notebook: no entries.
- External partiality: initial acquisition reached the distinct-event budget;
  the authored-history window was bounded. Profile hydration otherwise
  completed normally.
- Exit reason: three distinct media families and five publisher/source
  postures were understood before the 35-command budget.

#### Arrangement findings

The same arrangement remained useful after the posture shifted from graph
movement to relation analysis. Populated-field facts made attachment and media
fields discoverable; orientation panels made filter and explode cardinality
visible; exact details preserved declared versus inferred evidence.

Nested command construction caused the second suite friction. This time the
focused contract had been requested, but its nested shape was not attended to
carefully enough in the console representation. This joins Voyage 1's
preservation-shape error as repeated evidence that factual contracts are
available but raw construction remains fragile. No fix is made during the
suite.

No correctness defect or missing media primitive was found. The arrangement
remains unchanged.

### Voyage 3 result: weak-signal pursuit

Status: completed on 2026-07-29.

The navigator pre-registered `poetry` as the weak signal after a broad
ten-term scan of 350 random notes returned 29 `history` matches but only one
`poetry` match. This made the anti-popularity choice explicit before movement.

The single event combined short reflective text, dense art and healing
hashtags, and generated imagery. Its author resolved as `Hiyoko`, whose profile
explicitly described daily words and AI-generated images. Three branches were
tested:

- authored history produced a coherent 20-note stream of highly repetitive
  seasonal poetry, healing language, art hashtags, and imagery;
- referenced accounts returned zero; and
- linked-domain continuation returned zero in the resident corpus.

Shared-tag continuation should have supplied a fourth local branch but exposed
a correctness defect: the continuation lowered its tag constraint into a
top-level `#t` local query field even though local memory accepts tag
constraints under `tags`. The route failed honestly without mutation.

The navigator preserved 20 authored excerpts and recorded the account as
`uncertain`: the weak signal was coherent, but it remained a single repetitive
account stream rather than a discovered group.

#### Measurements

- Research commands: 22 through judgment, excluding configuration and final
  `list`/`status`.
- Contextual schema consultations: 1 for populated scan fields.
- Invalid commands: 1, caused by the internal shared-tag lowering defect rather
  than caller construction.
- Control groups used:
  - contact: `hydrate`, `continue`;
  - movement: `extract`, `move`;
  - analysis: `relate`, `scan`, `aggregate`, `filter`;
  - judgment: `remember`;
  - collection: `preserve`;
  - lifecycle: final `list` and `status`.
- Explicit senses: preview 3 times and details once.
- Handles at exit: 14.
- Transcript before close: 25 entries and 42,071 bytes, with no omissions.
- Observation buffer: 372 events at 43.8% pressure, no evictions, and no
  omitted observations.
- Archive: 20 excerpts.
- Notebook: 1 attributed `uncertain` judgment.
- Exit reason: a coherent weak signal was understood as a bounded
  single-account cluster before the 40-command budget.

#### Arrangement and correctness findings

The arrangement made the low-frequency signal, its exact evidence, and three
dead or narrow branches legible without substituting popularity. It did not
pull the navigator toward the dominant `history` term.

The local shared-tag route was corrected immediately after the voyage by using
the local query contract's `tags` object. The identical top-level-tag mistake
in local follower projection was corrected at the same owner. The existing
public continuation test now exercises a non-empty shared-tag result.

This was a correctness fix, not an arrangement change. The arrangement remains
unchanged for Voyage 4.

### Voyage 4 result: contradiction and rejection

Status: completed on 2026-07-29.

A random 300-note field yielded 30 sampled authors and 18 resolved profiles.
The planned profile-term scan returned zero candidates, so the navigator used
a profile preview rather than weakening the criterion invisibly.

`EVAN KALOUDIS` was selected because the profile claimed “Founder, ZEUS” and
described a software-builder identity. Before inspecting authored evidence, the
navigator recorded an `interested` judgment at strength `0.6`, the exact
profile-based reason, and explicit uncertainty that the claim could be stale,
promotional, or unrelated to current behavior.

A bounded 30-note authored window then supplied both confirming and potentially
weakening evidence:

- many posts were terse reactions or general conversation;
- the account sat inside a strongly central Bitcoin/Nostr network;
- no note in the window directly proved the founder claim; but
- several notes contained Lightning-wallet support, a concrete LDK/NWC
  workaround, Bitcoin protocol views, privacy discussion, and technical peer
  references.

A targeted scan found wallet, Lightning, and bug evidence. Eighteen referenced
accounts were discovered; a deterministic ten-account profile sample included
wallet, Bitcoin protocol, infosec, and cryptography identities. Exact account
details also exposed a Zeus-domain website, Lightning address, and NIP-05
string, while keeping those as unverified profile claims.

The disconfirming search therefore strengthened rather than reversed the
initial impression. The navigator replaced the notebook judgment with
`interested` at strength `0.85`, while explicitly retaining the unresolved
founder and identity claims and the central-network caveat. Thirty authored
excerpts were preserved.

#### Measurements

- Research commands: 24 through preservation, excluding configuration and
  final `list`/`status`.
- Contextual schema consultations: 0. The navigator used already-familiar
  operations and observation projections.
- Invalid commands: 0.
- Control groups used:
  - contact: `hydrate`, `continue`;
  - movement: `move`, `sample`, `pick`;
  - analysis: `relate`, `scan`;
  - judgment: two explicit `remember` moments;
  - collection: `preserve`;
  - lifecycle: final `list` and `status`.
- Explicit senses: preview 5 times and details once.
- Receipt-only decisions remained mechanical; both initial and final judgments
  used profile or authored evidence.
- Handles at exit: 15.
- Transcript before close: 27 entries and 64,041 bytes, with no omissions.
- Observation buffer: 359 events at 42.2% pressure, no evictions, and no
  omitted observations.
- Archive: 30 excerpts.
- Notebook: 1 current judgment whose update preserved the deliberate
  initial-to-final sequence in the transcript.
- Exit reason: the initial impression was explicitly strengthened with
  remaining caveats before the 30-command budget.

#### Arrangement findings

The arrangement supported pre-registration, disconfirming movement, and
revision of judgment without privileging confirmation or rejection. Earlier
evidence remained accessible through the transcript and notebook detail.

No contextual control consultation was needed because the navigator already
knew the operations. This is an important limit on the current experiment:
control grouping may help orientation and unfamiliar commands, while operator
fluency still supplies much of the command path. No arrangement or engine
change is justified by this voyage.

### Voyage 5 result: account depth

Status: completed on 2026-07-29.

The voyage acquired 350 random notes, moved to authors, deterministically
sampled 24 accounts, and resolved 20 profiles. `Yarnlady` was selected from the
profile preview because the profile described yarn work, bread, coffee, cigars,
books, and making physical objects—a posture distinct from the dominant
machine and Bitcoin-news traffic.

A 35-note authored window showed a conversational person rather than a
single-purpose publisher. The recent window was mostly short social replies,
but targeted analysis found concrete cigar and coffee evidence and references
to books and handmade objects.

Twenty referenced accounts formed the first ring. A deterministic 12-profile
sample included off-grid living, food growing, books, design/building, music,
games, Bitcoin, and ordinary social identities. The navigator selected the
off-grid account `atyh` for a second depth step. Its 20-note history contained
solar and battery calculations, LiFePO4 equipment, private-cloud discussion,
politics, and ordinary conversation.

The result was a qualified anchor rather than a quality score. The navigator
recorded `Yarnlady` as an `anchor` at strength `0.75`: useful for entering a
maker/social cluster, but with recent evidence dominated by casual
conversation and a still-visible Bitcoin-adjacent topology. Thirty-five
authored excerpts were preserved.

#### Measurements

- Research commands: 22 through preservation, excluding configuration and
  final `list`/`status`.
- Contextual schema consultations: 0.
- Invalid commands: 0.
- Control groups used:
  - contact: `hydrate`, `continue`;
  - movement: `move`, `sample`, `pick`;
  - analysis: `relate`, `scan`;
  - judgment: `remember`;
  - collection: `preserve`;
  - lifecycle: final `list` and `status`.
- Explicit senses: preview 5 times.
- Receipt-only decisions were mechanical; candidate and anchor decisions used
  profile or authored previews.
- Handles at exit: 15.
- Transcript before close: 25 entries and 84,909 bytes, with no omissions.
- Observation buffer: 452 events at 50.2% pressure, no evictions, and no
  omitted observations.
- Archive: 35 excerpts.
- Notebook: 1 qualified anchor.
- Exit reason: two navigation rings were completed and one explainable anchor
  was recorded before the 40-command budget.

#### Arrangement findings

The arrangement remained sufficient across repeated account/event/relation
transitions and two navigation rings. Profile and authored observations did
not collapse into one representation, and the anchor qualification remained
entirely navigator-authored.

As in Voyage 4, no contextual control consultation was needed. The journey was
operable partly because the navigator already knew the algebra. This repeated
finding weakens any claim that grouping alone solves command usability, but it
does not identify a missing engine operation or justify a hidden account-depth
recipe.

### Voyage 6 result: collection voyage

Status: completed on 2026-07-29.

The navigator chose `independent makers and builders` as the collection
intent. A random 400-note field produced 50 sampled authors and a hydrated
profile field. An exact word scan for maker identities found only two
candidates; a broader substring scan found five more, including several false
positives. The seven candidates were retained as one visible intermediate
collection rather than silently ranked.

Authored-note windows separated profile claims from observable activity. Five
profiles survived:

- `Implausible Deniability`: the profile claims filmmaking and the authored
  stream consistently publishes geopolitical media, but original production
  was not verified. It was retained as `uncertain`, not silently upgraded.
- `Mempool Madness`: repeated authored evidence showed operation of a concrete
  Bitcoin mempool-prediction product.
- `Yarnlady`: older authored notes independently mentioned yarn work and a
  craft room, supporting the profile's maker identity.
- `Tracking Token Disrespector`: repeated notes visibly performed and
  published a URL tracking-removal utility.
- `CryptoCloaks`: authored notes showed failed prints, miner assembly,
  physical-shop work, and manufactured products.

The AI-agent promotional account and a generic community account were rejected
from the final five. Every inclusion received its own attributed notebook
reason and strength. The five accounts were also recorded as the named
membership `independent-makers-builders`. Supporting authored evidence was
preserved separately as 280 excerpts.

#### Measurements

- Research commands: 61 through synchronization, excluding configuration and
  close. The nominal 60-command limit was crossed because the fifth candidate
  was already under verification; no new branch was opened after the limit.
- Contextual schema consultations: 4, for `remember`, `continue`, `preserve`,
  and `remember-membership`.
- Invalid commands: 5:
  - one focused-schema request that omitted its required input handle;
  - two attempts using `authored-events` instead of the exposed
    `authored-notes` relationship; and
  - two scans using `event.content` instead of the populated `event.text`
    field.
  The contextual contracts corrected both research-command mistakes
  immediately. Failed commands did not mutate session state.
- Control groups used:
  - contact: `hydrate`, `continue`;
  - movement: `move`, `sample`, `pick`, `union`;
  - analysis: `relate`, `scan`;
  - judgment: five `remember` actions;
  - collection: five `preserve` actions and one `remember-membership`;
  - lifecycle: final `list` and `status`.
- Explicit senses: profile, authored-note, and evidence previews throughout.
- Handles at exit: 31.
- Transcript before close: 64 entries and 186,671 bytes, with no omissions.
- Observation buffer: 830 of 950 events, 87.4% pressure, no evictions, and no
  omitted observations.
- Archive: 280 excerpts of 300 available entries.
- Notebook: 5 attributed judgments and 1 named membership.
- Exit reason: five supported profiles were collected. The buffer and archive
  were both nearing pressure limits, making the stopping point operationally
  meaningful as well.

#### Arrangement findings

The arrangement supported a real collection discipline: a broad candidate
field stayed visible, rejected candidates remained distinct, profile claims
were checked against authored behavior, and uncertain evidence remained
uncertain. Notebook judgments, membership, and preserved evidence kept their
different responsibilities.

This posture generated much more state than the earlier voyages. Thirty-one
handles, 280 archived excerpts, and high buffer pressure make lifecycle
orientation a first-class vessel concern. The controller exposed all three,
but the navigator still had to manage the sequence deliberately.

The largest remaining usability cost was again raw command construction.
Focused schemas repaired wrong relationship and field names, but only after
failure. The schema contains the necessary facts; the current arrangement does
not yet make those facts easy to use while composing a command.

## Cross-voyage conclusions

The six voyages exercised distinct postures over the same engine:

- thread descent prioritized exact relationship evidence;
- media trail repeatedly moved between events, attachments, domains, and
  accounts;
- weak-signal pursuit resisted the largest visible subject;
- contradiction required an explicit before-and-after judgment;
- account depth favored repeated identity/evidence transitions; and
- collection accumulated qualified subjects and durable supporting evidence.

They produced measurably different journeys without different engine commands.
This supports the vessel premise: posture can live entirely in caller-side
attention, sequencing, observation, and judgment conventions.

The first arrangement is useful but incomplete:

1. Its observation projections consistently kept cardinality, evidence,
   partiality, and exact details legible.
2. Its control grouping helped with unfamiliar operations and supplied enough
   information to recover from mistakes.
3. It did not materially remove command-construction friction. Fluent voyages
   consulted no schema; unfamiliar or nested commands still failed before the
   navigator returned to the factual contract.
4. No voyage required a new engine operation. The only engine defect found was
   the local tag-query lowering bug, which was corrected and covered at the
   public boundary.
5. Receipts were sufficient for mechanical continuation decisions, never for
   research judgment. Profile, event, relation, detail, or explanation
   evidence remained necessary wherever the navigator concluded anything.
6. Lifecycle pressure grows with posture. The collection voyage in particular
   showed that handle count, buffer pressure, archive pressure, and deliberate
   stopping belong in the navigator-facing arrangement.

The next coherent experiment is therefore not a hidden recipe, named
procedure, ranking rule, or general vessel framework. It is a small
schema-backed command composer on the caller side:

- start from one contextual operation contract;
- expose its required and optional choices in their actual nested shape;
- accept only navigator-supplied values;
- produce a complete, visible command draft for review;
- never choose a route, execute automatically, chain operations, or conceal
  the resulting controller command.

This targets friction repeated across the thread, media, and collection
voyages while preserving the ownership boundary: the engine owns facts, the
arrangement owns attention and expression, and the navigator owns direction
and conclusions.
