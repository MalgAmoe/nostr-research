# Nostrarium voyage trials

Status: direct operator trials on 2026-07-29.

## Purpose

These trials tested the current engine as the control surface for a navigator
before introducing a neutral wrapper or defining a vessel. They deliberately
used:

- one persistent JSONL session per voyage;
- real relay data from `nos.lol`, `relay.primal.net`, and
  `relay.snort.social`;
- bounded, relatively random kind-1 fields;
- sequential decisions made only after reading the preceding response;
- no arbitrary JavaScript and no engine changes during the trials.

The purpose was not to prove a particular research result. It was to observe
which controls and information repeatedly matter while moving through the
field.

## Voyage 1: broad field to one uncertain account

### Contact

A 350-event kind-1 acquisition reached its distinct-event bound:

- 350 distinct events;
- 448 accepted observations;
- 98 duplicate observations;
- 2 content-warning events excluded;
- 205 authors;
- observation-buffer pressure of 0.35.

The report made the difference between a successful command and an incomplete,
bounded encounter explicit.

### Movement and analysis

The field was related into rows and first characterized mechanically:

- all 350 rows had the `content` role;
- all 350 were `plain-text`;
- 43 contained media and 307 did not.

Those facts oriented the field but did not identify useful directions. A broad
scan for music, science, privacy, history, photography, cryptography,
literature, painting, and architecture produced:

- 73 match rows;
- 31 matching subjects;
- only 4 distinct authors.

Most matches came from a large SEO-like source. One privacy note remained
interesting enough to inspect. Its author was extracted, hydrated, and resolved
as `Paulthefree`, whose profile described a Bitcoin podcaster and software
tester. A relay continuation then acquired 60 authored notes.

The authored history was topically coherent but formulaic enough that the
navigator recorded the account as `uncertain`, not `interested`. The original
note was preserved as excerpt evidence.

### What this voyage exposed

- A random field needs orientation before it needs direction.
- Summary and preview are complementary senses: summary establishes scale and
  bounds; preview exposes texture and anomalies.
- A broad keyword match is not a conclusion. Author concentration changed how
  the match count was interpreted.
- A promising note was insufficient evidence for an account judgment. Profile
  hydration and authored-note continuation materially changed the judgment.
- The recurring subject-pivot sequence was:

  ```text
  candidate row
  → filter
  → extract stable subject
  → hydrate
  → observe
  → continue authored evidence
  → judge
  ```

- An attempted move to referenced accounts returned zero. This was a valid dead
  end, not a failure.
- Twelve handles accumulated during a modest investigation. Handle awareness
  and release are genuine lifecycle concerns.

## Voyage 2: media as an orientation surface

### Contact

A 400-event kind-1 acquisition produced:

- 400 distinct events;
- 441 accepted observations;
- 41 duplicates;
- 4 content-warning events excluded;
- 46 events with media.

### Analysis

Exploding the normalized media families produced 51 family observations:

- 37 image;
- 9 video;
- 5 unknown.

Exploding normalized attachments produced 46 attachment rows:

- 31 `declared`;
- 15 `inferred`.

The attachment records exposed URL, family, MIME type, classification, source,
dimensions, duration, alternative text, hashes, and fallbacks where present.
This was substantially more useful than a single `hasMedia` flag because it
kept declared and inferred knowledge separate.

Ranking media-note authors showed that the most frequent media authors in this
window had only three notes each. Hydrating the leading eight accounts exposed
a more important pattern: several were localized instances of the same
automated news system. The media itself did not establish that fact; the
account pivot did.

### What this voyage exposed

- `hasMedia` is useful for entering a media region; normalized attachments are
  needed to understand what that region contains.
- Media family and classification are useful orientation facts, not quality
  judgments.
- The distinction between declared and inferred attachment facts should remain
  visible to any caller.
- Ranking by activity can reveal coordinated or replicated account families,
  but the navigator must interpret them.
- Schema consultation corrected two invalid guesses during the voyage:
  aggregate members use `name`, not `as`, and sort directions are
  `ascending`/`descending`.
- One schema detail was less clear: `extract` listed the possible
  `subjectType` values but did not visibly say that `subjectType` was required.
  The error corrected the command, but a neutral controller should not have to
  learn this through failure.
- Relations deliberately do not have the collection `limit` operation. A
  bounded preview was enough for observation, while `extract` supplied the
  subject bound for the next movement.

## Voyage 3: random authors to an account anchor

### Contact

The first sandboxed session produced three pre-open connection failures and an
honest empty partial acquisition. Retrying with network permission produced:

- 300 distinct kind-1 events;
- 355 accepted observations;
- 55 duplicates;
- 1 content-warning event excluded;
- 200 distinct authors.

This demonstrated an essential navigator distinction:

```text
zero events because no relay opened
≠
zero matching events after a conclusive attempt
```

### Movement and judgment

Thirty authors were selected with a deterministic sample and hydrated:

- 24 of 30 account subjects resolved;
- 6 remained missing;
- 150 immutable metadata events were acquired;
- the distinct-event bound was reached.

The 150-event handle was not itself the desired account view. Moving from those
metadata events to their authors produced 24 stable account subjects; relating
those accounts then resolved one current profile row per account.

A scan of current profile descriptions for broad human-role terms found one
`scientist` match: `aak_btc`, whose profile claims data-science and Bitcoin
work. Forty authored notes were acquired. They showed a varied, coherent
history rather than only a matching biography, so the navigator recorded the
account as `interested`, while explicitly noting that the profile claim was not
independently verified.

### What this voyage exposed

- Deterministic sampling is a useful, non-curatorial way to reduce a broad
  author field while preserving repeatability.
- Hydration completeness counts account subjects, while its result handle
  contains immutable metadata events. The distinction is correct but demands a
  visible pivot:

  ```text
  hydrated metadata events
  → authors
  → current account rows
  ```

- Current profile resolution and immutable-event evidence are different
  representations of the same encounter. A caller must not blur them.
- A profile statement is a candidate signal. Authored history supplies a
  different class of evidence before judgment.
- The notebook correctly stored the navigator's conclusion without giving it
  engine authority.

## Cross-voyage control picture

The current layers remain useful, but the trials make their practical roles
more precise.

### Contact

Controls:

- relay set;
- NIP-01 filter;
- acquisition bounds;
- warning exclusion;
- explicit hydration or continuation.

Information needed immediately afterward:

- whether any relay opened and subscribed;
- completion reason and reached bounds;
- distinct events versus observations and duplicates;
- excluded warnings;
- corpus pressure and evictions.

### Movement

Controls:

- local typed `move`;
- relation-to-subject `extract`;
- explicit external `continue`;
- deterministic `sample`;
- identity set operations.

Information needed:

- input, discovered, output, and omitted counts;
- whether the route is local or external;
- output subject kind;
- evidence resolution state;
- the exact relationship or field lineage that permits the transition.

### Senses

The minimum useful sensing rhythm was:

1. summary for shape, scale, lineage, and bounds;
2. preview for representative texture;
3. focused schema before an unfamiliar transformation;
4. coverage/details only when external behavior or exact evidence matters.

No one mode replaces the others. Automatically dumping details would be as
unhelpful as showing only counts.

### Analysis

The useful primitives were generic:

- relate;
- scan and filter;
- explode;
- aggregate;
- sort;
- extract.

The engine should continue to expose facts rather than conclusions. Media
classification, author frequency, keyword concentration, and profile claims
became useful only when the navigator interpreted them in context.

### Judgment

Judgment entered after evidence pivots, not at first contact. In both account
voyages, authored history changed or strengthened the initial impression.
Notebook values remained intentionally small (`interested`, `uninterested`,
`uncertain`, `anchor`); labels, notes, reasons, and attribution carried the
voyage-specific meaning.

### Collection

Notebook judgment and preserved evidence served different purposes:

- notebook: what the navigator concluded about a stable subject;
- archive: what exact evidence the navigator chose to carry.

A vessel will need to make this distinction easy to maintain. It must not
silently preserve everything judged or infer a judgment from preservation.

### Lifecycle

Even short voyages produced 10–12 handles. The session already exposes enough
truth to manage them, but raw manual operation makes naming, replacement,
release, and current-focus tracking expensive.

The buffer pressure signal was useful. No voyage reached eviction pressure, so
these trials do not justify new memory policy.

## Implications for a neutral control layer

The evidence supports a small caller-side controller, not a new engine
abstraction. Its first responsibilities should be mechanical:

1. Keep one session alive and own command IDs, revisions, response correlation,
   and transcripts.
2. Maintain a visible registry of named handles with kind, count, lineage,
   bounds, and current focus.
3. Obtain controls from global or contextual schema rather than duplicating
   operation contracts.
4. Present each completed action with a compact orientation packet:
   result identity and kind, cardinality/bounds, important external coverage,
   and a bounded preview when meaningful.
5. Make subject pivots explicit, especially relation `extract`, hydration, and
   the metadata-events-to-current-accounts transition.
6. Make release and replacement ordinary lifecycle actions.
7. Allow the navigator to choose every next operation. Do not rank routes,
   recommend a conclusion, or hide a plan behind a convenience action.

The recurring bundles observed here may later become caller-side recipes or
arrangements, but they should remain compilations into visible engine
operations. They are not evidence for named procedures inside the engine.

## Remaining questions for further voyages

- Which orientation packet is useful across all result kinds without becoming
  another oversized response?
- Should current focus be a caller-only concept, or is a visible selected
  handle sufficient?
- How should a caller show immutable hydration events beside current resolved
  subjects without confusing them?
- Which handle-lifecycle conventions reduce clutter without releasing evidence
  the navigator still needs?
- Which differences between future vessels arise from contact defaults, senses,
  judgment tempo, or collection intent rather than from new commands?

These questions should be answered by building the smallest neutral controller
and using it, not by adding speculative engine behavior.

## Controller-operated voyage

After the first neutral controller and Node JSONL transport passed their
worker/reviewer tasks, one further random-field voyage tested the new boundary
against live relays.

The controller:

- started one persistent JSONL child process directly;
- generated and correlated 25 command IDs;
- retained all 25 command/response entries in a bounded transcript;
- exposed compact response receipts without issuing observations;
- synchronized handle and status state only when explicitly requested;
- closed the session and child process cleanly with exit code 0;
- used no shell pipeline, sleep, FIFO, or temporary response file.

A 300-event field reached the distinct-event bound. Its compact receipt kept
the facts needed before deciding whether to continue:

- handle `field`, kind `events`, count 300;
- external status `partial`;
- bound `distinct-event-budget`;
- the warning text explaining that bounded completion.

The navigator then explicitly requested summary and preview. A broad subject
scan produced 63 match rows over 27 events but only four authors. Aggregation
showed that one author supplied 60 of those matches. The other three accounts
were extracted and hydrated, resolving `blockstr`, `animalstr`, and
`naturestr`. Their authored-note continuation returned repetitive automated
block-art or stock-media output, so the navigator marked the three accounts
`uninterested` for this voyage while retaining the evidence that led to the
judgment.

Handle lifecycle was materially easier to reason about:

- the first explicit synchronization reported 8 handles, 6 shown, and 2
  omitted;
- later synchronization reported 9 handles, 6 shown, and 3 omitted;
- a subsequent mutation visibly made the cached catalog stale;
- `release-all` followed by explicit synchronization reported zero handles;
- the final transcript contained 25 entries and 56,472 retained serialized
  bytes with no omissions.

The trial confirmed the intended boundary. The controller removed process,
correlation, revision, transcript, and catalog bookkeeping. It did not remove
the navigator's need to choose operations, observation modes, interpretations,
or judgments.

One small state defect was discovered and corrected: before a first successful
`synchronize`, a `null` handle catalog must be reported as stale. A missing
catalog is not an authoritative empty catalog.
