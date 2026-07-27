# Research library and command usage review

Field-trial date: 2026-07-27

Status: archived field-trial analysis; not the current simplification plan.

## Purpose

This document records what it was actually like to use the current Nostr
research library and persistent JSONL session for sustained research.

It is deliberately a usage review rather than an API specification. The
important question is whether a researcher can repeatedly:

1. acquire a bounded piece of Nostr;
2. inspect it without drowning in raw events;
3. select a promising subject;
4. gather more evidence around that subject;
5. make and preserve a judgment;
6. move in another direction;
7. allow disposable evidence to leave the working buffer.

The observations come primarily from two live research trials:

- finding credible privacy and security people while rejecting bots,
  aggregators, project feeds, and promotional accounts;
- finding original photographers while distinguishing them from reposting and
  generic image accounts.

The trials used real relay data from `wss://nos.lol/`,
`wss://relay.primal.net/`, and, where available, `wss://relay.damus.io/`.
The session used an event capacity of 700.

## Overall assessment

The current system is genuinely usable for research for the first time.

The useful core is not a predefined search task. It is this loop:

```text
acquire
→ obtain a bounded view
→ inspect candidates
→ select one subject
→ fetch or traverse related evidence
→ make a human judgment
→ remember the judgment or membership
→ continue in another direction
```

That loop supported both trials even though the research criteria were very
different. This is evidence that the library is approaching the intended
general research playground rather than encoding one domain-specific answer.

The main weakness is no longer lack of operations. It is friction around:

- knowing which operation and parameter shape to use;
- receiving far more structural output than is useful at the current moment;
- moving cleanly between subject collections and relation results;
- understanding which evidence is transient, remembered, or preserved;
- encountering old command names and examples that no longer match the live
  protocol.

The next work should improve this interaction surface before adding more
operations.

## What worked well

### Sequential research

Working sequentially was much easier to reason about than running many branches
in parallel. A productive sequence was:

1. acquire topical notes;
2. use a scan or bounded preview to identify possible leads;
3. inspect one lead;
4. move from its note to its author;
5. hydrate the profile;
6. continue to authored notes;
7. inspect a small sample;
8. remember a judgment;
9. either traverse outward or return to the candidate pool.

At each stage the user or agent decides what matters. The system supplies
evidence and navigation; it does not need to decide whether an account is a
person, a project, an expert, or interesting.

### Candidate verification

The authored-note continuation is especially valuable. A topical match alone
was frequently misleading. Fetching 30–50 notes from one account made it
possible to distinguish:

- a person producing first-hand work;
- a commercial or project feed;
- an aggregator;
- a bot;
- an account with one promising note but insufficient evidence;
- a credible person whose general feed is much noisier than the initial note.

For photography, one candidate resolved to `nuko`, whose profile identified
street photography and several cameras. Fifty authored notes consistently
contained original images, places, and camera information.

Another resolved to `danielw`, whose profile identified landscape photography.
Thirty authored notes consistently contained original images, capture dates,
locations, and occasional camera-workflow commentary.

For security, the strongest candidate was a real builder with a substantial
protocol proposal. The same trial also exposed how many apparent security
results were commercial tools, news feeds, quote bots, or marketing.

### Bounded external operations

Relay acquisition reported its limits clearly. Reaching a distinct-event
budget produced a successful partial outcome rather than pretending to be
complete or failing the command.

This distinction was useful:

```text
command succeeded
≠ relay research was exhaustive
```

The continuation response exposed:

- distinct events obtained;
- duplicate observations;
- relay completion;
- bounds reached;
- events added, refreshed, and evicted.

Those are good operational facts. They belong in a detailed or diagnostic view,
although most do not need to appear in every ordinary response.

### Buffer turnover

The 700-event buffer reached full capacity during the trials. Continuing to
research candidates evicted 55 older events.

This was desirable. The session behaved like a moving research vessel rather
than an ever-growing database. The current working evidence changed as the
research moved.

### Notebook and membership separation

The two photography judgments were stored with:

- stable account identity;
- `interested` judgment;
- strength;
- caller-written reason;
- attribution;
- labels.

They were then queried back through the notebook. Named memberships also
survived corpus turnover.

This validates a useful separation:

```text
buffer
  Disposable canonical evidence used for current investigation.

notebook
  Durable caller judgments and annotations about stable subjects.

membership
  Durable named sets of stable subjects plus reasons for inclusion.

archive
  Explicitly preserved evidence, when the evidence itself must survive.
```

This model is clearer than treating every named result as saved research.

### Valid empty results

Expanding from the street photographer to followed accounts returned a valid
empty result. That was correctly represented as an empty research outcome, not
as an operational failure.

This matters on Nostr because absence from the queried relays can be valid,
partial, or simply a consequence of the account not publishing that event.

## Where usage was difficult

### Command discovery

Several commands required consulting source files or the full schema to
discover their exact parameter shape.

Examples:

- authored-note retrieval is `continue` with
  `relationship: "authored-notes"`, not `acquire` with an account input;
- relay continuation uses `eventLimit`, `observationLimit`,
  `distinctEventLimit`, and other explicit bounds;
- whole-corpus selection requires `scope: "corpus"`;
- hydration accepts relay acquisition bounds directly and does not accept
  `target`, `source`, or `eventLimit`;
- a scan operates on a relation, not directly on every collection.

Strict validation is useful, but a rejection should help the caller construct
the correct next command. At present, many errors only say that parameters are
unknown.

The complete `schema` response contains the answer, but it is enormous. It is a
machine contract, not practical interactive help.

### Stale terminology

Old field-trial artifacts and documentation still refer to commands such as:

- `annotate`;
- `retain`.

The current commands are:

- `remember` for subject judgments;
- `remember-membership` for named subject membership.

Trying the older commands produced `Unsupported command`. This is especially
confusing because the concepts still exist under new names.

The project does not need compatibility for obsolete experimental commands,
but all living documentation and examples should use the current vocabulary.
Historical artifacts should be clearly historical or should not be relied on
as command documentation.

### Overly verbose presentation

`show` frequently emitted much more than was needed to decide the next move.
Account views included empty facets, zero-valued media presence, corpus
accounting, membership-evidence summaries, freshness, relationship summaries,
and other orientation information.

These facts are not useless. The problem is that they appear together for
nearly every view. During research, the immediate questions are usually:

```text
What is this?
What are a few representative items?
What evidence supports this collection?
Is anything missing or truncated?
```

The current output makes those answers expensive to read.

The default should be a small decision-oriented projection. Detailed
orientation, provenance, corpus state, and facet information should remain
available through explicit modes.

### Relation results are conceptually exposed

Some operations produce relations rather than ordinary subject collections.
That is powerful, but the distinction becomes visible as command friction.

For example, `scan` requires relation input and emits one row for each matching
field and term. A single event matching several terms therefore appears
several times. The rows are valuable for explaining matches, but:

- the result count is not a count of unique notes;
- previews can repeat the same note;
- the user often wants to return immediately to unique subjects;
- consuming relation rows uses attention without necessarily adding evidence.

The relation layer should remain because it is the compositional foundation.
The session needs clearer and easier projections from relations back to unique
events or accounts.

### `event.hasMedia` inconsistency

A filter using `event.hasMedia == true` returned no results even though the
same notes visibly contained image URLs and `imeta` information. Scanning
`event.links` for image extensions found 217 matching notes.

This appears to be a field-resolution bug or an inconsistency between canonical
event presentation and relation field derivation. It materially affected a
normal research operation and should be investigated.

### Naming judgments versus memberships

There are two related but distinct operations:

- `remember`: store a judgment about each subject;
- `remember-membership`: store that subjects belong to a named set.

The distinction is good, but it is not immediately obvious from the command
names. `replace-membership` further complicates discovery because it only
replaces an existing membership. It cannot create one, and fails with “No
notebook membership found.”

A caller should be able to learn this lifecycle without reading implementation
code:

```text
remember-membership  create or extend a named set
replace-membership   replace the members of an existing named set
membership           inspect one named set
memberships          list named sets
delete-membership    delete one named set
```

### Empty expansion offers no next orientation

A valid empty followed-account expansion is correctly represented, but the
caller is left to know possible alternatives. Useful alternatives might be:

- hydrate or retrieve the follow-list event directly;
- query followers instead;
- inspect mentions or replies;
- return to the prior candidate pool;
- expand through referenced accounts in authored notes.

The engine does not need to recommend what is interesting. A concise response
can still expose which traversal routes are valid from the current collection.

## Thoughts on individual commands

### `acquire`

This is a good explicit network boundary. It should remain responsible only for
starting from relay filters without an input handle.

The distinction from continuation is important:

```text
acquire   Start from a relay query.
continue  Start from selected subjects and obtain related evidence.
```

The bounds are useful but numerous. Named presets or caller-side helpers may
eventually improve ergonomics, but the canonical operation should keep the
explicit budgets.

### `select`

Whole-corpus selection is valuable for recovering a known event after other
handles or views have changed.

Requiring `scope: "corpus"` is defensible, but the error could state the exact
fix. Selection from an input handle versus selection over the full corpus
should remain visibly distinct.

### `filter`

Filtering is core and should remain small and predictable. It should operate on
typed fields and preserve subject identity, evidence reasons, and provenance.

Its usefulness depends heavily on field correctness. The media-field problem
shows why derived fields need focused functional verification at the public
operation boundary.

### `scan`

Scan is useful for exploratory text matching across selected fields. It was
helpful when the vocabulary was not known in advance.

Its current result shape is explanatory rather than subject-oriented: one row
per field and matching term. This is valid, but callers need an easy way to:

- count unique source subjects;
- collapse matches by subject;
- move back to matching events;
- show the matched term without repeating the full event for every term.

The command should clearly report both `matchRowCount` and
`distinctSubjectCount`.

### `pick`, `sample`, `balance`, and `limit`

These are important because the human or agent cannot inspect everything.
Their role is presentation and attention management, not truth scoring.

`balance` was particularly useful for preventing one prolific account from
occupying an entire candidate preview. The balancing field and resulting
omissions must remain visible.

### `move`

Move is a good local graph operation when the relationship is already present
in resident evidence:

- notes to authors;
- notes to referenced accounts or events;
- accounts to locally known authored or followed entities.

The route must be discoverable from the current collection kind. A compact
“available moves” observation would reduce schema lookups.

### `continue`

This is the most important navigation operation after acquisition. It bridges
selected subjects to additional local or relay evidence.

The name is generic, but the explicit `relationship` makes the operation
composable. The useful relationships include authored notes, profiles, follow
lists, followed accounts, followers, replies, ancestors, mentions, quotes,
conversations, shared tags, linked domains, and general expansion.

The current parameter surface is correct but hard to recall. A small,
relationship-specific schema query would help.

### `hydrate`

Hydration is useful for resolving account metadata and supporting evidence
without changing the identity of the account collection.

The relationship between the returned hydration handle and the original
account handle can be confusing: after hydration, showing the original account
handle resolves through the now-current canonical profile. This is useful, but
should be stated in concise output.

### `show`

Show needs the most presentation work.

It should make these modes concrete:

- `summary`: count, collection kind, truncation, completeness, corpus effect;
- `preview`: bounded representative subjects;
- `coverage`: evidence resolution, relay coverage, missing or partial inputs;
- possibly `details`: the current comprehensive output.

The default should not be the comprehensive mode.

For event previews, the most useful fields were:

- stable event ID;
- resolved author identity;
- timestamp;
- content excerpt;
- media or link presence;
- observed relays;
- membership reason in the current result.

For account previews:

- stable public key;
- name and display name;
- NIP-05;
- description excerpt;
- resolved/unresolved status;
- notebook judgment, when present;
- reason for membership in the current result.

### `inspect`

Inspect should remain subject-centered and independent of one result:

```text
What does the current session know about this event or account?
```

This is different from `show`, which describes a named result, and `explain`,
which describes why a subject belongs to a named result.

That distinction remains sound.

### `explain`

Explain is important once a pipeline has several transformations. It should
answer:

- why the subject is in the result;
- which stage introduced or retained it;
- what source evidence and provenance are attached;
- whether any required canonical evidence has been evicted.

It should not repeat every general facet of the result.

### `remember`

Remember is the right operation for human or agent judgment. It does not ask
the engine to infer meaning.

The current fields are useful:

- judgment;
- strength;
- reason;
- attribution;
- stable source references;
- labels;
- note.

The required reason and attribution are good disciplines. They prevent a
judgment from looking like an engine-generated fact.

### `remember-membership`

This is useful for saved selections such as:

- credible candidates;
- accounts to revisit;
- examples of project feeds;
- counterexamples;
- a research-specific cohort.

Membership preserves identity and reasons, not all source evidence. That rule
should remain explicit.

### `preserve`

Preservation is needed when the actual evidence, not merely the subject
identity and judgment, must survive buffer turnover.

It should remain explicit and exceptional. Automatically archiving everything
would undermine the moving-buffer model.

### `schema`

The full schema is valuable for machines, protocol validation, and generating
other interfaces. It is not a good interactive help response.

The protocol would benefit from bounded schema queries such as:

```text
schema command continue
schema relationship authored-notes
schema input ricoh-author
schema fields events
schema moves accounts
```

These can be projections of the same canonical schema rather than a new
semantic layer.

## Suggested improvements, in priority order

### 1. Fix correctness and vocabulary drift

- Investigate and fix `event.hasMedia`.
- Update current documentation and examples from `annotate` to `remember`.
- Update current documentation and examples from `retain` to
  `remember-membership`.
- Clearly mark historical field trials as historical.
- Ensure error messages use the canonical current terminology.

### 2. Make ordinary output decision-oriented

- Make `show` default to a concise preview or summary.
- Move full facets, corpus accounting, provenance, orientation, and
  relationship statistics behind explicit modes.
- Avoid printing zero-valued or empty sections unless requested.
- Report truncation and partial external completeness even in concise mode.
- Keep every response bounded.

### 3. Add focused command discovery

- Allow schema projection by command, relationship, collection kind, or field.
- On invalid parameters, return accepted parameter names and a minimal example.
- On a collection result, expose valid next operations or move routes without
  recommending a research judgment.
- Distinguish network operations visibly from local operations.

### 4. Smooth relation-to-subject navigation

- Report unique-subject counts separately from relation-row counts.
- Provide an obvious projection from scan matches to unique source subjects.
- Make repeated matches from one event compact in preview output.
- Preserve the explanatory relation rows for `explain` and detailed inspection.

### 5. Clarify the durable-state lifecycle

- Document notebook judgments, memberships, preserved evidence, named handles,
  and transient corpus evidence together.
- Explain create, query, replace, and delete membership operations.
- Report what will survive eviction and what will disappear.
- Keep preservation explicit rather than automatic.

### 6. Improve empty-result orientation

- Keep empty results successful and machine-readable.
- Show whether the result is exhaustively empty or only empty within bounded
  relay attempts.
- Expose valid traversal alternatives for the current collection kind.
- Do not invent recommendations about which alternative the researcher should
  choose.

## What should not be added yet

The field trials do not justify:

- automatic classification of people versus projects;
- automatic expert scoring;
- automatic interestingness;
- large domain-specific research commands;
- parallel autonomous research branches;
- an additional scripting language;
- automatic retention of every event;
- more operations merely to shorten one trial.

The existing algebra and session are broad enough to continue learning. The
best next improvements are correctness, clarity, bounded presentation, and
discoverability.

## Recommended next validation

After the improvements above, repeat two long trials rather than many small
tests:

1. start from a noisy topic, find several credible people, and deliberately
   preserve both positive judgments and counterexamples;
2. start from one credible person, traverse authored notes, references,
   conversations, and social relationships until a coherent small group is
   found or the evidence honestly runs out.

The validation should measure practical interaction:

- how often source or schema lookup is necessary;
- how many commands fail due to discoverability rather than invalid intent;
- how many response lines must be read before choosing the next action;
- whether unique-subject counts remain understandable through relation stages;
- whether buffer eviction ever destroys evidence the researcher expected to
  keep;
- whether notebook and membership queries reconstruct the selected research
  direction without replaying the entire session.

## Final view

The library has found a credible core:

```text
bounded evidence
+ composable local operations
+ explicit relay continuation
+ caller judgment
+ selective memory
```

It does not need to understand the world for the user. It needs to make the
available evidence navigable, allow the user to express selections and
judgments, preserve only what matters, and make the next operation easy to
construct.

The current system can already do that. The next step is to make doing it
clearer and less exhausting.
