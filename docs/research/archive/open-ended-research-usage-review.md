# Open-ended research usage review

Date: 2026-07-27

Status: archived field-trial analysis; not the current simplification plan.

## Scope

This document records observations from an open-ended live research session
using the current Nostr research library and JSONL command interface.

The session was intentionally different from earlier goal-oriented trials.
There was no target such as “find ten cryptographers.” The starting instruction
was:

1. acquire 250 recent notes;
2. scan broadly for music, science, privacy, art, and history;
3. explore in many directions;
4. find different profiles that seemed personally interesting.

The purpose was to test whether the library supports curiosity and changing
direction, not merely whether a predefined query can be completed.

This is a companion to `research-library-and-command-usage-review.md`. It
focuses on new observations from this open-ended exploration rather than
repeating the complete command review.

## Session outline

The initial acquisition queried three public relays:

- `wss://nos.lol/`
- `wss://relay.primal.net/`
- `wss://relay.damus.io/`

It acquired:

- 250 distinct kind-1 notes;
- 336 accepted observations;
- 86 duplicate observations;
- no unsuccessful relay;
- a result bounded by the 250-distinct-event budget.

The session used a 700-event working buffer. Subsequent hydration,
authored-note retrieval, and conversation traversal grew the corpus to:

- 544 resident events;
- 206 authors;
- 6 event kinds;
- 2,415 tags;
- 5,110 outbound relationships;
- 5,110 inbound relationships;
- 77.7% buffer pressure;
- no eviction.

Six profiles were remembered with individual judgments and collected in the
named membership `open exploration profiles I liked`.

## The actual path

The productive path was not the path initially imagined.

The intended path was approximately:

```text
random recent notes
→ broad subject scan
→ several topical pools
→ interesting profiles
```

The actual path was:

```text
random recent notes
→ broad scan dominated by machine activity
→ manually reject obvious machine sources
→ find one credible security post
→ find one credible Nostr builder post
→ inspect their authors
→ retrieve authored notes
→ traverse referenced accounts
→ inspect profiles in that neighborhood
→ retrieve selected authored feeds
→ scan noisy authored feeds for sparse substantive notes
→ enter one technical conversation
→ find additional profiles through discussion
→ remember profiles with different confidence levels
```

This difference is important. Open-ended discovery was not driven by a better
global scan. It was driven by escaping the global feed through one credible
local edge.

## What the initial scan revealed

### Broad terms are weak selectors

The scan terms included variations around:

- music;
- science;
- privacy;
- art;
- history.

These words occur in many contexts unrelated to meaningful human discussion.
Examples included:

- browser and streaming activity encoded as JSON;
- enormous SEO/search-engine dumps;
- automated archive mirrors;
- stock-photo reposting;
- generic inspirational text;
- project marketing;
- quoted titles rather than authored discussion.

The first scan was heavily dominated by one account publishing activity-state
JSON. Its events contained words such as `audio` and `history` because they
described open browser tabs. The terms matched correctly, but the matches were
semantically useless for this investigation.

The library did not fail to scan. The scan accurately exposed why lexical
matching is insufficient as an orientation method.

### Relation-row multiplication magnifies noise

`scan` emits one relation row for each matching field and term. A single noisy
event matching both `audio` and `history` appeared twice. Repeated activity
events from the same account then multiplied the effect.

This causes three forms of perceptual distortion:

1. match-row count looks larger than the number of distinct notes;
2. one author can occupy most of a preview;
3. one long machine event can appear important because it matches many terms.

The explanatory relation shape is valid, but the default presentation needs to
distinguish:

```text
match rows
distinct events
distinct authors
```

For orientation, distinct events or balanced authors should usually be the
first projection.

### Splitting scans by subject helped only slightly

After excluding the largest activity account, the broad scan was separated
into music, science, privacy, art, and history results.

This made the shape of the noise easier to see, but did not create five useful
research directions:

- music produced an SEO dump and generic poetic text;
- science was dominated by another enormous search/SEO event;
- history mostly found archive-mirroring posts and SEO text;
- art found stock-photo accounts and one false positive around drawing map
  geometry;
- privacy produced one substantial security-related post.

The main benefit was diagnostic. It showed which subjects had a credible local
lead. It was not a discovery engine by itself.

## The first useful pivots

Two notes survived inspection:

1. a detailed explanation of the Linux Foundation’s Akrites security
   initiative;
2. a post praising Earthly and describing its integration with ContextVM.

These produced three initial profiles:

### Toro

Toro’s profile describes an AI educator covering Bitcoin and AI. Thirty-five
authored notes included substantial explainers about:

- Akrites and open-source incident response;
- GrapheneOS and a legal case concerning privacy features;
- persistent memory governance in AI agents;
- AI-generated medical misinformation;
- AI model releases and copyright.

The content was relevant and often detailed. However, its frequency, uniform
structure, and news-summary style suggested a possibly automated or heavily
assisted publishing process.

This profile was useful but not selected. The library supplied enough evidence
to separate “interesting content source” from “profile I personally want to
follow.”

### ContextVM

ContextVM resolved as a project account for a decentralized MCP transport over
Nostr. Its authored notes included:

- concrete CLI releases;
- payment integration;
- implementation discussion;
- interaction with other builders;
- promotion of compatible Nostr tools.

It was retained as an interesting project rather than misclassified as a
person.

### Schlaus Kwab

The Earthly post referenced Schlaus Kwab. Profile and authored evidence showed:

- active development of Earthly;
- open geographic workspaces;
- offline operation;
- private sharing;
- map and photo datasets;
- MLS group-state handling;
- re-encryption and signed checkpoints;
- NIP-60 wallet cautions;
- relay rejection caused by oversized `r` tags;
- public discussion of scaling and privacy tradeoffs.

This became the strongest anchor in the session.

## Why the neighborhood worked

Moving from Schlaus and ContextVM authored notes to referenced accounts produced
a much healthier candidate pool than the broad feed.

The neighborhood included profiles related to:

- FOSS and privacy development;
- Nostr protocols;
- photography;
- art and electronics;
- infrastructure and relay discovery;
- decentralized identity and Web of Trust;
- community projects;
- open geographic tools.

This does not prove every neighbor is interesting. It shows that a credible
local anchor produces a higher-value orientation space than a random global
lexical scan.

The critical operation was:

```text
credible account
→ authored notes
→ referenced accounts
→ hydrate profiles
→ bounded profile projection
```

This should be considered a first-class research pattern, even if it remains a
composition of general operations rather than a dedicated command.

## Profile verification produced reversals

### TravelTelly strengthened

TravelTelly’s profile claimed original travel photography. Twenty authored
notes consistently supported that claim through:

- named locations;
- original hosted images;
- travel and cycling activity;
- recurring photographic output;
- discussion of using embedded GPS data on a map.

The profile became more interesting after authored-note inspection.

### Gzuuus initially weakened, then partially recovered

Gzuuus’s profile mentioned technology, art, electronics, Bitcoin, and
crypto-anarchism. The first authored preview mostly showed:

- greetings;
- short replies;
- images without explanation;
- social participation.

The profile initially looked weaker.

A focused scan inside the authored notes recovered sparse substantive
contributions:

- a question about providing historical messages to new group members;
- questions about group infrastructure;
- a concrete concern that shared stream keys could let arbitrary members issue
  valid deletion requests in a public or large group.

This demonstrated that a chronological preview can hide the best evidence.

### Sandwich weakened under recent activity

Sandwich’s profile listed many substantial Nostr infrastructure projects,
including relay discovery and NIP work. The recent authored sample was
dominated by repeated `GM` notes.

A focused technical scan over that 20-note window returned no matches.

The correct conclusion was not that the profile was fraudulent. It was that
the selected recent evidence window did not substantiate the impressive
profile. The library needs to help express that distinction.

### ButtercupRoberts weakened

The profile described storytelling and research around Nostr, Bitcoin, privacy,
and open systems. The sampled recent feed was primarily casual reactions,
greetings, and media.

Again, this did not disprove the profile. It reduced confidence that this
particular window supported the initial reason for interest.

### Agi Choote remained appealing but unverified

The profile’s combination of art and electronics was attractive. Recent
authored notes showed chess, flying, images, and casual conversation, but did
not substantiate the art/electronics direction.

The profile remained personally appealing but was not placed in the final
saved selection.

### Sebastix strengthened

Sebastix’s profile described:

- Nostr-PHP maintenance;
- Web of Trust work;
- FOSS and privacy;
- full-stack development;
- interaction design;
- self-hosting.

The recent notes showed a real multifaceted person:

- practical infrastructure downtime;
- self-hosted media;
- GrapheneOS use;
- cellular-network workarounds;
- cycling;
- interest in John Maeda’s *The Laws of Simplicity*.

The evidence did not consist entirely of technical essays. Its value was the
coherence between profile, activity, and practical behavior.

## Conversation traversal added a different kind of evidence

The session entered the conversation around Schlaus’s Earthly release note.
This exposed contributions that were invisible in normal authored previews.

Examples included:

- questions about historical state for new group members;
- discussion of Cashu wallet risk presentation;
- NWC as an alternative;
- extension-based Nostr authentication;
- avoiding direct nsec entry into websites;
- photo sightings as individual points or datasets;
- encrypted checkpoint design for new group members.

This produced an important lesson:

```text
An authored feed shows what someone broadcasts.
A conversation shows how someone thinks with other people.
```

For several profiles, conversation evidence was more informative than the main
feed.

## Profiles selected

Six profiles were remembered, each with a separate reason and confidence.

### Schlaus Kwab — 0.95

Selected for first-hand work on Earthly, geospatial tooling, offline and private
sharing, encrypted group-state handling, and practical protocol debugging.

### TravelTelly — 0.90

Selected for sustained original travel photography and the connection between
photographic metadata and geographic exploration.

### Sebastix — 0.86

Selected as a credible FOSS/privacy practitioner combining protocol work,
development, interaction design, self-hosting, and daily use.

### ContextVM — 0.84

Selected explicitly as a project account for coherent protocol implementation,
MCP-over-Nostr work, discovery, identity, and payments.

### Dr. The Daniel — 0.72

Selected despite a casual main feed because conversation evidence showed
specific product and security judgment around wallets and Nostr authentication.

### Gzuuus — 0.70

Selected with lower confidence because the useful evidence was sparse but
showed genuine engagement with group history and deletion-authority problems.

The set intentionally contains:

- people and a project;
- technical and nontechnical work;
- strong and tentative selections;
- profiles supported by different evidence types.

## What worked well in the command system

### Explicit acquisition boundaries

The initial acquisition correctly reported that it stopped at the global
distinct-event budget. Later continuations reported observation or event
budgets independently.

### Hydration

Hydrating account collections before presenting their profiles made
neighborhood inspection effective. Profile resolution was complete across the
two primary relays for the selected neighborhoods.

### Local movement

These moves were productive:

- note to author;
- note to referenced accounts;
- authored notes to referenced accounts.

### Relay continuation

Fetching authored notes and conversations from selected subjects was the
primary source of useful evidence.

### Projection

Converting account collections into relations and projecting:

- subject ID;
- account name;
- display name;
- description;

produced a much more usable neighborhood view than ordinary `show`.

This is strong evidence that the algebra can already produce good interactive
views. The missing piece is convenient presentation, not a new data model.

### Focused scan inside a bounded account feed

Scanning one person’s authored notes for specific technical concepts was much
more useful than scanning a global random corpus.

The same operation was weak globally and useful locally. Scope matters more
than the existence of the operation.

### Notebook judgments

The system supported different confidence strengths and explicit caller
reasons. This was important because some selections were based on profiles,
some on authored notes, and some on conversation behavior.

### Set composition

The six selected account handles were combined through repeated `union`
operations and saved as one membership. This worked, though the repeated
commands were mechanically awkward.

## Command and library problems

### 1. Mixed conversation could not move to authors

After retrieving a 31-event conversation, this command failed with an internal
error:

```text
move conversation → authors
```

The conversation included several event kinds, including:

- kind 1 notes;
- kind 6 reposts;
- kind 7 reactions;
- one unresolved subject.

`show` could present the collection and resolve several authors, but `move`
could not derive the author collection.

This is a correctness bug. Mixed event collections should either:

- move all events with authors to distinct account subjects and report
  omissions; or
- reject the route during preflight with a specific reason.

An internal error is not acceptable for a normal public operation.

### 2. Broad `show` remains exhausting

Even in preview mode, ordinary account and event output includes extensive:

- orientation;
- facets;
- freshness;
- corpus accounting;
- membership evidence;
- provenance;
- relationship summaries.

These sections are valuable diagnostically, but they repeatedly obscure the
evidence needed for the next decision.

The manually constructed projected account relation was far easier to use than
the standard account preview.

### 3. Terminal echo interleaves commands and responses

When several JSONL commands were written in one batch, the PTY output
interleaved echoed input with responses. Some displayed command text appeared
visually malformed even though the interpreter executed the commands
successfully.

This is not an engine-semantic problem, but it makes a live agent session hard
to audit. The CLI adapter should ideally run without terminal echo or support a
mode where only response lines are written to stdout.

### 4. Discoverability still requires memory or schema lookup

The session depended on remembering distinctions such as:

- `relate` before `scan`;
- `continue` for subject-driven relay retrieval;
- `move` for locally resident edges;
- `scope: "corpus"` for whole-buffer selection;
- explicit hydration budgets;
- projection fields;
- `remember` versus `remember-membership`.

The commands are coherent after learning them, but the live interface does not
make the next valid shapes obvious.

### 5. Repeated union is clumsy

Combining six selected profiles required five binary union commands.

The binary algebra is clean and should remain canonical. The session adapter
could safely accept a list of handles and compile it into the same normalized
union stages, or `union` could accept named multiple inputs if that already
fits the operation model.

This is an ergonomic improvement, not a need for a new operation.

### 6. Evidence windows are easy to overinterpret

Twenty or twenty-five recent authored notes frequently produced misleading
impressions:

- substantial builders looked trivial because the recent window contained
  greetings;
- appealing profile claims lacked supporting evidence in the window;
- useful comments appeared only inside a particular conversation.

Every authored-note result should make its temporal and count bounds visually
prominent. The system should help the researcher say:

```text
not substantiated in this window
```

rather than:

```text
not true
```

### 7. Broad random acquisition offers weak orientation

The first 250 notes were not representative of “what Nostr is discussing.”
They were simply the first bounded results obtained from the selected relays
and filters.

The library correctly avoids claiming representativeness, but the interaction
could emphasize:

- relay composition;
- time span actually represented;
- author concentration;
- machine-like repetition;
- very large event outliers;
- dominant domains;
- proportion of repeated observations.

These are not quality scores. They are diagnostics about the sample one is
about to navigate.

## A more useful open-discovery methodology

Based on this trial, a good manual methodology is:

### Phase 1: acquire and diagnose

Acquire a bounded recent corpus and inspect:

- author concentration;
- repeated content;
- extreme event sizes;
- event kinds;
- common linked domains;
- obvious automated sources.

Do not immediately treat topic counts as meaningful.

### Phase 2: create several weak signals

Use broad scans, tags, domains, and media presence only to create possible
entry points. Balance by author and collapse duplicate subjects.

### Phase 3: choose one credible anchor

Select a note that contains first-hand substance:

- a concrete implementation;
- an original work;
- a specific argument;
- a detailed question;
- a meaningful conversation.

### Phase 4: verify the anchor

Hydrate its author and inspect a bounded authored window. Separate:

- profile claims;
- authored broadcast behavior;
- conversation behavior;
- project identity;
- human identity.

### Phase 5: enter the neighborhood

Traverse:

- referenced accounts;
- quoted accounts;
- conversation authors;
- followed accounts, when available;
- authors of referenced notes.

Hydrate the resulting accounts and inspect a concise profile projection.

### Phase 6: test candidates with different evidence

For each promising profile:

- fetch authored notes;
- scan for sparse substantive concepts if the feed is noisy;
- inspect one technical or creative conversation;
- look for first-hand work;
- retain uncertainty when the evidence window is inadequate.

### Phase 7: remember judgment, not supposed truth

Store:

- why the profile is interesting to the current researcher;
- strength of interest;
- evidence type;
- uncertainty;
- labels useful for the current path.

Do not encode a global quality or expertise score.

## Improvements suggested by this trial

### High priority

1. Fix `move events → authors` for mixed conversation results.
2. Add a concise default account projection.
3. Report scan rows, distinct subjects, and distinct authors separately.
4. Offer a direct collapse from scan relations to unique subjects.
5. Make authored-note time and count windows prominent.
6. Provide focused schema help for the current handle and operation.
7. Prevent JSONL command echo from interleaving with response output.

### Medium priority

1. Add sample diagnostics for author concentration, event-size outliers, and
   repetitive sources.
2. Make valid next moves discoverable from a result handle.
3. Make multi-handle union less mechanical while preserving the same algebra.
4. Provide a concise way to compare:
   - profile evidence;
   - authored evidence;
   - conversation evidence.
5. Allow presentation to balance previews by author without changing the
   underlying collection.

### Not yet justified

This trial does not justify:

- automatic bot classification;
- automatic person-versus-project classification;
- global interestingness scores;
- automatic expertise judgments;
- automatic semantic topic models;
- hardcoded “discover interesting people” workflows;
- autonomous parallel exploration;
- retention of the entire investigated corpus.

The user or agent still made the meaningful decisions. The system’s job was to
provide bounded evidence and reversible navigation.

## Broader conclusion

The library is better at navigation than search.

More precisely:

```text
Global lexical orientation is noisy.
Local evidence traversal is powerful.
```

This is not a failure of the project’s core idea. It clarifies the core:

```text
The research system is not a search engine that produces the right people.
It is a vessel for moving from weak signals to stronger local evidence.
```

The useful unit is not the query result. It is the research transition:

```text
I saw this
→ therefore I inspected that
→ which revealed these accounts
→ one of which produced this evidence
→ so I chose to remember it for this reason
```

The current library can express that transition. The next improvements should
make each transition easier to see, easier to construct, and less expensive to
read.
