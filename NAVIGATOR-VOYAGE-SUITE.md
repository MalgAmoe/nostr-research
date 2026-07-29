# Navigator voyage suite

Status: active experimental protocol for testing the first navigator-facing
arrangement.

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
