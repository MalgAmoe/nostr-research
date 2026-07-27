# Current Nostr research system analysis

Date: 2026-07-27

Status: archived synthesis; superseded as current direction by
`../system-simplification-direction.md`.

## Purpose

This document is a consolidated analysis of the current Nostr research
library, its persistent declarative session, and the command interface used to
operate it.

It distills the findings from:

- `research-library-and-command-usage-review.md`;
- `open-ended-research-usage-review.md`;
- the live research sessions that produced those reviews;
- the current understanding of the project’s intended direction.

This is not another chronological field-trial report. It is an assessment of
the system itself:

- what the library currently is;
- what it does well;
- where it is weak or incoherent;
- how it should be used;
- what its limitations are;
- what capabilities would materially improve it;
- what should remain outside the library;
- how the project should evolve without becoming unnecessarily complicated.

## Executive assessment

The current system has found a credible core.

It is no longer merely a collection of Nostr fetching utilities, and it is not
a conventional search engine. It is a bounded research environment in which a
human or agent can:

1. acquire a manageable piece of Nostr;
2. construct local views over that evidence;
3. select subjects;
4. navigate to related evidence;
5. inspect profiles, notes, relationships, and conversations;
6. make explicit judgments;
7. remember selected identities and reasons;
8. allow the transient evidence pool to change as research moves.

The strongest part of the system is local navigation after a credible subject
has been found.

The weakest parts are:

- global orientation over noisy relay data;
- interactive command discoverability;
- default presentation;
- moving cleanly between relations and subject collections;
- communicating the limits of evidence windows;
- a small number of correctness and terminology problems.

The library already has enough algebraic power for meaningful research. Adding
many more operations would not currently make it substantially better. The
most valuable work is to make existing operations:

- easier to construct;
- easier to compose;
- easier to inspect;
- less exhausting to read;
- more consistent across collection kinds;
- more honest about what was and was not observed.

The central product idea can be stated simply:

> The system helps a researcher move from weak signals to stronger local
> evidence while preserving the researcher’s own selections and judgments.

## What the system is

The current system consists of several related layers.

### Nostr acquisition

The acquisition layer connects to public relays and retrieves events using
bounded NIP-01 filters.

It understands that relay access is:

- external;
- incomplete;
- duplicated across relays;
- bounded by time, observations, and distinct events;
- potentially affected by connection failures;
- not equivalent to an exhaustive global query.

### Bounded research memory

Acquired canonical events live in a bounded in-memory corpus.

The corpus is intended to be a working buffer, not a permanent mirror of
Nostr. As it reaches capacity, new evidence can replace older evidence.

This gives the system an important property:

```text
The research environment can move without retaining everything it has ever
seen.
```

### Subject collections

The library represents stable research subjects such as:

- events;
- accounts;
- relationships;
- mixed subjects where necessary.

Collections preserve identity and the reasons subjects entered a result.

### Relations

Relations expose composable values associated with subjects. They support
operations such as:

- filtering;
- projection;
- sorting;
- distinct selection;
- aggregation;
- scanning;
- joins;
- slicing;
- derived values.

The relation layer is the flexible algebra that replaced arbitrary dynamic
JavaScript for most research operations.

### Graph navigation

The system supports local movement and relay-backed continuation.

Local movement uses relationships already present in resident evidence.

Relay continuation starts from selected subjects and asks relays for additional
related evidence, such as:

- authored notes;
- profiles;
- follow lists;
- followed accounts;
- followers;
- replies;
- ancestors;
- mentions;
- quotes;
- referenced events;
- conversations;
- shared tags;
- linked domains;
- broader expansion.

### Declarative session

The persistent JSONL session gives the library:

- named result handles;
- command sequencing;
- revision tracking;
- bounded observations;
- result lifecycle;
- a stable response envelope;
- a non-JavaScript interaction surface.

The session is the current practical environment for an agent to use the
library interactively.

### Notebook

The notebook stores caller-authored judgments about stable subjects.

A judgment can include:

- interested, uninterested, uncertain, or anchor;
- strength;
- reason;
- attribution;
- labels;
- a note;
- stable source references.

Notebook entries are interpretations supplied by the researcher. They are not
facts inferred by the engine.

### Named memberships

Memberships preserve named sets of stable subjects and reasons for inclusion.

They are useful for selections such as:

- profiles worth revisiting;
- counterexamples;
- project feeds;
- credible candidates;
- a cohort assembled for one investigation.

Membership preserves identity and selection rationale, not necessarily the
canonical evidence itself.

### Evidence archive

The archive explicitly preserves evidence that must survive working-buffer
turnover.

It supports a separate decision:

```text
Remember the subject
versus
preserve the evidence.
```

That distinction is fundamental to the current architecture.

## The core research model

The library is most coherent when understood as a research loop rather than a
query API.

```text
Acquire
→ orient
→ select
→ inspect
→ navigate
→ verify
→ judge
→ remember or preserve
→ continue
```

### Acquire

Bring a bounded piece of relay evidence into the working corpus.

### Orient

Understand the sample before assuming it represents anything:

- size;
- kinds;
- authors;
- time range;
- duplicate observations;
- relay coverage;
- domains;
- tags;
- media;
- obvious concentration or repetition.

### Select

Choose a manageable subset or one concrete subject.

### Inspect

Look at bounded evidence about the selected result or subject.

### Navigate

Move locally through known edges or retrieve additional related evidence from
relays.

### Verify

Compare different evidence around a subject:

- profile claims;
- authored notes;
- conversations;
- first-hand work;
- references;
- social neighborhood.

### Judge

The researcher decides whether the subject is useful for the current inquiry.

### Remember or preserve

Remember the interpretation, preserve membership, or explicitly archive
evidence when necessary.

### Continue

Choose another direction without requiring the system to retain the complete
path or all previously observed events.

## What is good about the current library

### 1. The system has a coherent boundary

The library supplies operations over evidence. It does not attempt to replace
the researcher’s perspective.

This is one of the strongest design decisions in the project.

The engine does not need to decide:

- whether an account is a real person;
- whether a project is legitimate;
- whether someone is an expert;
- whether content is interesting;
- whether one worldview is correct;
- whether a profile should be followed.

It provides enough structure for the caller to make those decisions.

This keeps the library general and prevents provisional research criteria from
becoming hardcoded truth.

### 2. The operations are broadly composable

The current algebra can express a wide variety of investigations without
domain-specific commands.

The same building blocks supported:

- identifying original photographers;
- rejecting commercial and automated security feeds;
- finding protocol builders;
- entering technical conversations;
- examining a profile neighborhood;
- finding sparse substantive contributions inside noisy activity;
- preserving selections with different confidence levels.

This is evidence that the operation set is close to the correct abstraction
level.

### 3. External work is explicitly bounded

The system treats relay work as bounded attempts rather than pretending that a
query is globally complete.

It records:

- attempted relays;
- relay outcomes;
- observations;
- duplicates;
- distinct events;
- bounds reached;
- connection failures;
- corpus effects.

It also distinguishes:

```text
command success
research completeness
```

A command can succeed while producing a partial external result. That is the
correct model for Nostr.

### 4. The bounded corpus is conceptually right

The project should not require a complete permanent database to be useful.

The working corpus gives the researcher:

- fast local operations;
- bounded resource use;
- a concrete current evidence pool;
- natural pressure to select and preserve what matters;
- the ability to move rather than accumulate indefinitely.

The earlier turnover trial demonstrated that notebook entries and memberships
can survive while canonical events leave the working buffer.

This validates the “vessel” model:

> The application carries a limited working environment through a much larger
> information universe.

### 5. Stable subject identity is preserved

Named results, notebook entries, memberships, and relations refer to stable
event or account identities.

The system does not need to copy entire records into every operation result.
Canonical evidence can be resolved from the current buffer or archive when
available.

This is important for:

- deduplication;
- memory use;
- consistency across views;
- result composition;
- evidence turnover.

### 6. The notebook expresses subjectivity honestly

The notebook requires caller-written reasons and attribution.

This prevents a remembered judgment from appearing to be an objective engine
fact.

Strength is useful because interest is rarely binary. A profile can be:

- strongly supported;
- provisionally interesting;
- uncertain;
- worth retaining as a counterexample.

Labels remain caller-defined rather than becoming a rigid taxonomy.

### 7. Membership and evidence preservation are separate

The distinction between:

- remembering a judgment;
- retaining membership in a named set;
- preserving canonical evidence;

is excellent.

It allows the system to remain lean while keeping important research
orientation.

### 8. Authored-note continuation is highly useful

Fetching a bounded authored-note window often reveals whether an initial match
is:

- representative;
- accidental;
- promotional;
- automated;
- part of a coherent body of work;
- unsupported in the selected window.

It is one of the most practically valuable operations in the library.

### 9. Conversation retrieval reveals interaction quality

Conversation evidence adds something that profile metadata and broadcast feeds
cannot provide.

It can reveal:

- how someone asks questions;
- how they respond to criticism;
- whether they understand implementation details;
- whether they contribute concrete alternatives;
- whether they engage with other builders;
- whether their public profile claims align with their reasoning.

The library’s conversation support is therefore central to discovering
interesting people, not merely reading threads.

### 10. Profile hydration works as a resolution layer

Accounts remain stable subjects even when profile metadata is initially
missing.

Hydration can add current kind-0 evidence without replacing the account’s
identity. Existing account handles can then resolve through newly available
canonical evidence.

This is a sound model for incomplete Nostr data.

### 11. Relations provide real flexibility

The relation layer makes it possible to express operations that would
otherwise require custom JavaScript:

- scan several fields;
- filter by structured predicates;
- project concise account views;
- sort;
- deduplicate;
- aggregate;
- balance;
- derive values;
- compare sets.

The relation layer should be kept. The problem is not its existence; the
problem is how much of its internal shape the interactive caller currently has
to manage.

### 12. The protocol boundary is reusable

The JSONL command protocol is useful for:

- agents;
- terminal use;
- functional tests;
- automation;
- future alternative implementations.

The same command and response objects could later travel over:

- stdin and stdout;
- worker messages in a browser;
- a desktop-process boundary;
- another local transport.

The protocol is not tied to one UI.

## What is bad or weak about the current library

### 1. Global orientation is weak

Acquiring recent notes and scanning broad concepts does not reliably reveal
meaningful subjects.

The problem is structural:

- relays contain human discussion, bots, applications, telemetry, mirrors,
  reposts, and machine workflows;
- common words occur inside irrelevant machine payloads;
- one large event can contain many accidental matches;
- one prolific account can dominate a sample;
- random recent results are not representative of global attention.

The library can retrieve and scan this material, but it does not yet provide
enough sample diagnostics or noise-resistant orientation.

This is currently the largest practical limitation.

### 2. Lexical scan is easy to misread

`scan` returns one relation row for each matching field and term.

That explanatory representation has consequences:

- result count is not distinct-note count;
- repeated terms multiply rows;
- long events match many concepts;
- one author can dominate a preview;
- matched rows appear more important than they are.

The operation is more useful inside a small, meaningful collection than across
a random global corpus.

The library should expose at least:

- match-row count;
- distinct-subject count;
- distinct-author count;
- author concentration;
- an easy collapse back to source subjects.

### 3. The default presentation is too verbose

`show` frequently returns:

- preview subjects;
- facets;
- freshness;
- corpus pressure;
- membership evidence;
- provenance;
- relationship summaries;
- resolution statistics;
- truncation information;
- zero-valued sections.

These details are individually useful, but presenting them together for normal
inspection makes the output difficult to use.

The researcher usually needs a smaller decision surface:

```text
What is in this result?
What are a few representative subjects?
Why are they here?
What is missing or truncated?
What can I do next?
```

The current presentation increases cognitive load and consumes agent context.

### 4. Command discoverability is poor

The canonical operations are coherent once learned, but the caller must
remember many details:

- `acquire` cannot take an input;
- `continue` is used for subject-driven relay work;
- `relate` is needed before relation operations such as `scan`;
- whole-corpus selection requires `scope: "corpus"`;
- hydration has its own external bounds;
- local `move` and relay `continue` are different;
- `remember` and `remember-membership` have separate meanings;
- `replace-membership` only replaces an existing membership;
- collection kinds determine valid fields and routes.

The full schema contains these answers but is too large for interactive use.

The interface needs focused help generated from the canonical schema.

### 5. Relations leak too much into interactive work

Relations are the correct internal compositional mechanism. However, the
interactive session often forces the caller to manage the distinction between:

- subject collections;
- event collections;
- account collections;
- relationship collections;
- relation rows.

Common research intentions require mechanical transitions such as:

```text
subject collection
→ relate
→ scan
→ distinct or collapse
→ return to source subjects
```

These transitions should remain semantically explicit, but they should be
easier to construct and inspect.

### 6. Evidence windows are not prominent enough

A recent authored-note window can make:

- a serious builder look trivial;
- a project look inactive;
- a social account look more substantive than it is;
- a profile claim look unsupported;
- sparse useful work disappear among greetings and replies.

The library reports technical bounds, but ordinary presentation does not make
the interpretive consequence sufficiently visible.

The system must help distinguish:

```text
The claim is false.
```

from:

```text
The selected evidence window did not substantiate the claim.
```

### 7. Broadcast activity and conversational activity are not unified

Authored-note retrieval gives a chronological broadcast-oriented window.
Conversation retrieval gives thread context.

Both are useful, but the library lacks a concise way to compare:

- what the profile claims;
- what the account broadcasts;
- how it behaves in conversations;
- what first-hand artifacts it links or produces.

This comparison should not become automatic classification. It should become a
better evidence view.

### 8. Some normal operation paths still fail

The open-ended trial found an internal error when moving a mixed conversation
event collection to authors.

The input contained multiple event kinds and one unresolved subject. `show`
could display resolved authors, but `move` could not produce the account
collection.

A public operation should:

- succeed for every valid subject it can resolve and report omissions; or
- reject the route during preflight with a specific semantic error.

An internal error breaks trust in the algebra.

### 9. Derived field behavior is inconsistent

`event.hasMedia == true` returned no results over notes that visibly contained
image links and media metadata. Scanning image extensions in links found many
matches.

Derived fields are useful only if their semantics are consistent across:

- canonical event parsing;
- relation materialization;
- filtering;
- presentation.

This needs correction and a small number of focused functional checks.

### 10. Terminology and historical examples have drifted

Older examples use commands such as:

- `annotate`;
- `retain`.

The current commands are:

- `remember`;
- `remember-membership`.

There is no need to preserve experimental compatibility, but living
documentation must not teach obsolete commands.

Historical field-trial artifacts should be clearly separated from current
reference material.

### 11. Set composition is more mechanical than necessary

Combining six selected profiles required five binary union commands.

Binary union is a clean algebraic primitive, but the session could compile a
multi-handle convenience form into the same normalized operation sequence.

The current form is correct but unnecessarily tedious for interactive
selection.

### 12. Empty outcomes lack orientation

The system correctly distinguishes valid empty results from command failures.

However, after an empty result, the caller receives little help understanding
which other routes are valid from the current subject kind.

The engine should not choose the next direction, but it can expose:

- valid local moves;
- valid continuation relationships;
- whether additional relay resolution may help;
- whether the result was exhaustive or bounded.

### 13. JSONL terminal usage is hard to audit

In a PTY, batched command input can be echoed and interleaved with response
lines. The interpreter may execute correctly while the visible transcript
appears malformed.

This is an adapter problem rather than a library problem, but it directly
affects practical agent usage.

The CLI should support a clean machine mode with:

- no input echo;
- stdout reserved for response envelopes;
- diagnostics on stderr;
- one complete response per line.

### 14. Result-handle proliferation is visible

A long session accumulates many intermediate handles:

- selected notes;
- account pivots;
- profiles;
- authored windows;
- relations;
- scans;
- projections;
- unions.

Manual release exists, but the session does not yet make temporary versus
important handles easy to manage.

This does not require complicated automatic lifecycle management. It may only
need:

- concise handle listing;
- grouping by recent use or operation;
- multi-release;
- optional replacement of explicitly temporary handles.

## Where the library is most effective

The library is most effective after the researcher has one credible anchor.

A high-value pattern is:

```text
credible note
→ author
→ hydrate profile
→ authored evidence
→ referenced accounts
→ hydrate neighborhood
→ inspect concise profile view
→ verify selected candidates
→ enter conversations
→ remember judgments
```

This pattern works because local relationships constrain the search space
without pretending to identify objective relevance.

The library is also effective for:

- verifying whether content is first-hand;
- comparing accounts within a bounded cohort;
- collecting counterexamples;
- tracing protocol and project neighborhoods;
- identifying which profiles participate in a conversation;
- preserving a subjective research selection;
- revisiting stable identities after the working corpus changes.

## Where the library is least effective

The library is least effective when asked to:

- infer meaningful global topics from random recent relay events;
- rank all accounts by interestingness;
- separate people, projects, bots, and applications automatically;
- infer expertise from profile text;
- treat keyword frequency as subject importance;
- make a small relay sample representative of Nostr;
- retrieve everything relevant to an open-ended concept;
- summarize a long investigation into a concise decision surface without
  manual projection.

These limitations are partly implementation problems and partly properties of
Nostr itself.

## How to use the current library well

### 1. Start with bounded acquisition

Choose:

- a small relay set;
- a clear time or subject boundary;
- an observation limit;
- a distinct-event limit;
- a timeout.

Do not begin by trying to acquire everything.

### 2. Diagnose the acquired sample

Before interpreting topics, inspect:

- number of distinct authors;
- concentration by author;
- event kinds;
- largest events;
- repeated text;
- common domains;
- duplicate observations;
- relay contribution;
- actual time coverage.

The acquired corpus is a sample, not a global feed.

### 3. Treat broad scan as a weak signal

Broad scan should identify possible entry points, not final subject pools.

Collapse or balance matches before reading them. Prefer distinct events and
authors over raw match rows.

### 4. Choose one concrete anchor

A useful anchor normally contains first-hand substance:

- implementation detail;
- original creative work;
- a specific argument;
- a detailed question;
- a meaningful exchange;
- a concrete artifact.

### 5. Resolve the author

Move from the event to its account, hydrate profile evidence, and keep the
account identity separate from its current metadata.

### 6. Retrieve a bounded authored window

Use authored notes to test the initial impression, but record:

- event count;
- time bounds;
- relays;
- whether the result was partial;
- whether the preview is chronological, sampled, or balanced.

Do not treat absence from that window as proof.

### 7. Use focused scans locally

When the authored feed is noisy, scan it for the concepts that motivated the
selection.

Local focused scans are much more useful than global broad scans because the
subject scope is already meaningful.

### 8. Enter conversations

Use conversations to inspect interaction quality and find neighboring
participants.

Conversation evidence is especially important for profiles whose main feed is
mostly social.

### 9. Traverse the neighborhood

Use referenced accounts, quoted accounts, authors of referenced events, or
public social edges to discover adjacent profiles.

Hydrate profiles and project a concise neighborhood view before retrieving
every account’s authored notes.

### 10. Verify candidates selectively

Only expand profiles that genuinely look promising.

For each, compare:

- profile;
- authored window;
- conversation behavior;
- first-hand linked work.

### 11. Remember reasons and uncertainty

Use the notebook to record why the profile matters to the current inquiry.

Use strength to distinguish:

- strong evidence;
- provisional interest;
- uncertainty;
- counterexamples.

### 12. Preserve evidence only when needed

If stable identity and judgment are enough, use notebook and membership.

Use the archive only when exact evidence must survive buffer turnover.

### 13. Release disposable handles

Keep the interactive session legible by releasing temporary intermediate
results once they are no longer useful.

## Current command model

The command model is conceptually sound when grouped by purpose.

### Acquire evidence

- `acquire`
- `hydrate`
- `continue`
- `fetch`
- `expand`

### Select and constrain

- `select`
- `filter`
- `pick`
- `limit`
- `sample`
- `balance`

### Reshape and analyze

- `relate`
- `project`
- `distinct`
- `sort`
- `group`
- `summarize`
- `aggregate`
- `derive`
- `slice`
- `explode`
- `scan`
- `join`

### Navigate

- `move`
- relationship-specific `continue`

### Compose sets

- `union`
- `intersection`
- `difference`
- `compare`

### Remember and preserve

- `remember`
- `notebook`
- `forget`
- `remember-membership`
- `membership`
- `memberships`
- `replace-membership`
- `delete-membership`
- `preserve`
- `archived`
- `release-archive`

### Observe

- `show`
- `inspect`
- `explain`
- `status`
- `schema`
- `list`

### Manage session lifecycle

- `release`
- `release-all`
- `reset`
- `close`

The problem is not that these groups are fundamentally incoherent. The problem
is that the interactive surface exposes a flat command vocabulary without
enough contextual guidance.

## Capabilities the system should add or improve

### 1. Decision-oriented presentation

The most important improvement is a smaller default observation.

### Result summary

Show:

- collection kind;
- subject count;
- distinct authors where relevant;
- completeness;
- time bounds;
- truncation;
- evidence resolution;
- corpus effect only when material.

### Preview

Show only the fields needed to choose the next operation.

### Coverage

Show:

- relays;
- partial inputs;
- unresolved subjects;
- bounds reached;
- omissions.

### Details

Keep the current comprehensive output available explicitly.

### 2. Contextual operation discovery

The caller should be able to ask:

```text
What can I do with this handle?
What fields can I filter?
What local moves are valid?
What relay continuations are valid?
What parameters does this relationship accept?
```

This should be generated from the canonical schema, not implemented as a
second command system.

### 3. Better scan projections

Scan should make these values explicit:

- match rows;
- distinct source subjects;
- distinct authors;
- terms matched;
- fields matched;
- author concentration.

It should be easy to produce:

- unique matching events;
- unique matching accounts;
- matches grouped by subject;
- matches balanced by author.

### 4. Sample diagnostics

Before topical interpretation, the system should help expose:

- repeated content;
- large event outliers;
- prolific authors;
- machine-oriented kinds;
- dominant domains;
- relay skew;
- time skew.

These should be descriptive diagnostics, not automatic quality judgments.

### 5. Evidence-window visibility

Every externally retrieved authored or conversation view should prominently
state:

- since and until;
- event limit;
- actual result count;
- relay coverage;
- completeness;
- sampling or ordering method.

### 6. Evidence comparison views

The caller would benefit from a concise account-oriented evidence view:

```text
Profile
Recent authored activity
Conversation participation
First-hand artifacts
Notebook judgment
```

The system should present these sources without interpreting them into a global
classification.

### 7. Reliable mixed-collection navigation

Navigation across mixed event kinds must:

- resolve every valid subject;
- report omitted or unresolved items;
- preserve reasons and provenance;
- avoid internal errors.

### 8. Easier multi-handle composition

The session should allow a concise multi-input set composition that compiles to
the same canonical set operations.

### 9. Cleaner machine transport

The CLI adapter should provide:

- no command echo;
- strict JSONL stdout;
- stderr diagnostics;
- clean cancellation;
- clear process closure.

### 10. Better result lifecycle ergonomics

Useful additions could include:

- release several handles;
- replace a temporary handle explicitly;
- list handles with kind, count, origin, and last use;
- distinguish durable notebook state from disposable handles.

### 11. Focused correctness work

The system needs targeted checks for:

- derived media fields;
- mixed-event author movement;
- relationship resolution;
- stable subject identity through relation transformations;
- partial external outcomes;
- archive and buffer resolution after eviction.

These should be public functional tests at meaningful boundaries, not a large
unit test for every helper.

## What should stay outside the library

### Human meaning

The library should not decide what the user ought to value.

### Universal quality scores

There is no context-free measure of an interesting account.

### Hardcoded account categories

Person, project, bot, organization, and application can remain caller
interpretations unless a specific protocol fact proves otherwise.

### Domain-specific research recipes

Finding musicians, cryptographers, photographers, or historians should remain
compositions of general operations.

Reusable recipes may exist outside the core as saved plans or interface
helpers, but they should not redefine the algebra.

### Automatic retention

The system should not preserve every event it encounters.

### Arbitrary dynamic JavaScript

The declarative operation layer now covers the important research operations.
Reintroducing arbitrary JavaScript would weaken portability, safety, and
reasoning about state.

### Autonomous parallel exploration

The current system is easier to reason about when research proceeds
sequentially:

```text
select
→ inspect
→ decide
→ continue
```

Parallel autonomous branches would increase corpus pressure, handle
proliferation, and difficulty attributing why evidence was collected.

### Premature semantic automation

Embeddings, topic models, bot scores, and automated classifiers may eventually
be useful, but they should not be added merely because broad lexical scan is
noisy.

The current priority is to make evidence navigation clear and reliable.

## Important conceptual distinctions

The project should preserve the following distinctions.

### Search versus navigation

Search finds possible entry points.

Navigation develops stronger evidence around selected subjects.

The current library is better at navigation.

### Local versus external

Local operations transform resident evidence.

External operations ask relays for more evidence and can be partial.

### Subject versus evidence

A stable subject can remain remembered even when its canonical evidence leaves
the buffer.

### Evidence versus judgment

The library stores what was observed separately from what the researcher
thought about it.

### Judgment versus membership

A judgment describes a subject.

A membership records inclusion in a named selection.

### Membership versus archive

Membership preserves identity and rationale.

Archive preserves evidence.

### Command success versus research completeness

A correct command may still produce a bounded or partial research result.

### Absence versus contradiction

Missing evidence in a bounded window does not prove a claim false.

### Broadcast versus interaction

Authored feeds show broadcasts.

Conversations show participation and reasoning with others.

### Algebra versus interface

The algebra should remain small and composable.

The interface may provide conveniences that compile into the same canonical
operations.

## Strategic direction

The project should not attempt to become a complete Nostr search engine before
it becomes an excellent research navigator.

The next milestone should be:

> Make one sequential research path clear, reliable, bounded, and pleasant
> from acquisition through remembered judgment.

That milestone requires:

1. fixing the known correctness problems;
2. reducing default output;
3. adding contextual command discovery;
4. improving relation-to-subject transitions;
5. exposing evidence windows;
6. making neighborhoods and conversations easy to inspect;
7. keeping memory and preservation semantics explicit.

Once this path is strong, the project can learn whether it needs:

- richer sample diagnostics;
- saved research recipes;
- more efficient indexes;
- alternative implementations;
- a human-facing client;
- Rust or Wasm components;
- semantic assistance.

Those decisions should be based on repeated usage rather than speculation.

## Prioritized work

### Priority 1: correctness and trust

- Fix mixed conversation `move → authors`.
- Fix `event.hasMedia` semantics.
- Verify relationship traversal across supported event kinds.
- Remove or clearly separate obsolete command examples.
- Ensure public failures return semantic errors rather than internal errors.

### Priority 2: concise observation

- Redesign the default `show` output.
- Add explicit summary, preview, coverage, and details modes.
- Remove empty and zero-valued sections from ordinary output.
- Make bounds and evidence windows prominent.
- Add concise account-neighborhood presentation.

### Priority 3: discoverability

- Add focused schema queries.
- Expose valid operations for a handle.
- Return accepted parameters and a minimal correction with validation errors.
- Show local versus relay-backed next operations.

### Priority 4: relation ergonomics

- Collapse scan results to unique subjects.
- Report distinct events and authors.
- Group matches by subject.
- Balance previews by author.
- Make relation-to-subject projection obvious.

### Priority 5: research orientation

- Add descriptive sample diagnostics.
- Improve conversation participant inspection.
- Add evidence-source comparison for accounts.
- Make empty results suggest valid structural alternatives.

### Priority 6: session ergonomics

- Clean JSONL transport.
- Multi-handle set convenience.
- Multi-release and better handle listing.
- Clearer distinction between disposable handles and durable research memory.

## Criteria for evaluating future changes

A proposed change is valuable if it improves one or more of these:

- Can the researcher understand what evidence is currently available?
- Can the researcher choose a next direction without consulting source code?
- Can the researcher retrieve additional evidence without accidentally
  changing the meaning of the current selection?
- Can the researcher tell whether a result is partial?
- Can the researcher distinguish absence from contradiction?
- Can the researcher preserve a judgment without retaining all evidence?
- Can the researcher reconstruct why a subject was selected?
- Can the researcher operate without arbitrary JavaScript?
- Can the implementation remain small enough to debug?

A change is suspect if it:

- encodes provisional human judgment as universal truth;
- adds a large abstraction for one research task;
- duplicates existing algebra with different semantics;
- hides external bounds;
- makes state mutation implicit;
- retains data automatically;
- introduces parallel behavior that is difficult to attribute;
- exists primarily to satisfy low-value unit tests.

## Final perspective

The current library is already capable of meaningful Nostr research.

Its best qualities are:

- a bounded working corpus;
- stable subject identity;
- composable operations;
- explicit relay incompleteness;
- useful graph continuation;
- caller-owned judgment;
- selective durable memory;
- separation between identity, interpretation, and preserved evidence.

Its main weaknesses are:

- noisy global orientation;
- excessive presentation;
- difficult command discovery;
- relation friction;
- underemphasized evidence windows;
- inconsistent navigation in a few cases;
- some terminology and adapter problems.

The library should not try to eliminate the need for human perspective. That
need is part of research, not a defect.

The right goal is:

```text
Help the researcher see enough,
move deliberately,
retain what matters,
and understand the limits of every conclusion.
```

The system is close to that goal at the architectural level. The next gains
will come from clarity, reliability, and interactive ergonomics rather than a
larger operation set.
