# Nostrarium: system evolution analysis

Date: 30 July 2026  
Scope: the project from its first commit on 15 July through commit `ff64f73`
on 29 July.

## Executive assessment

Nostrarium began as a feature-rich SolidJS Nostr client and became something
more unusual: a UI-independent research engine, a persistent declarative
session, a neutral caller-side controller, and an open experimental layer for
inventing ways to navigate an unbounded and frequently incoherent public
field.

This was not a planned rewrite from one clean specification. The architecture
emerged through repeated use and repeated rejection of abstractions that did
not survive use. The project discarded:

- the original SolidJS client;
- saved browser investigations and local-storage state;
- SQLite and database-shaped persistence assumptions;
- an agent-facing dynamic JavaScript console;
- task-shaped research APIs and special expansion operations;
- prescriptive next-operation guidance;
- a single canonical UI or composer;
- and, most recently, the assumption that experiments should remain
  uncombined.

What survived is the actual core of the idea:

> Acquire bounded real evidence from Nostr, preserve its provenance, navigate
> between stable subjects and derived views, let the navigator decide what
> matters, and make uncertainty and omission visible.

The present system is technically strong. It has one runtime-neutral engine
path used by direct calls, plans, sessions, JSONL, browser Workers, and the
controller. It separates source evidence from interpretation and renewable
memory from deliberate preservation. Its functional suite exercises public
boundaries rather than freezing internal helpers. Live voyages have repeatedly
shown that the engine can support open-ended research without arbitrary
JavaScript.

The present product direction is intentionally unresolved. Above the stable
controller sit several disposable and sometimes contradictory systems:
schema-backed composition, a mutable Field workbench, Airlock, Pinball,
Darkroom, a combined shared-session voyage, and the Cock and Balls
two-reservoir probe. This is not architectural disorder by itself. It is the
current research method.

The deepest open question is no longer whether the engine can research Nostr.
It can. The question is what kinds of instruments let a human or agent
repeatedly turn a hostile random field into an intelligible journey without
silently importing someone else’s ranking, curation, or conclusions.

## 1. The original product: a discovery client

The first commit, `b5149aa`, was already ambitious. It contained a 793-line
SolidJS application with Tailwind, a local server, disposable keys, real relay
access, usage logs, and no fake corpus.

The original product ideas were recognizably the same as today:

- discovery rather than a chronological social feed;
- real relay data rather than fixtures;
- navigation among notes, accounts, replies, mentions, tags, reactions,
  reposts, and zaps;
- relay provenance;
- media-aware note rendering;
- evidence baskets and saved investigations;
- local usage telemetry;
- configurable relay sets;
- and a desire to move “from and to everywhere.”

This phase was valuable because it exposed the real problem. Nostr is not a
clean database of human conversation. Random relay traffic mixes social notes,
machine events, application payloads, spam, duplicated observations,
mis-tagged events, pornography, scams, and partially implemented protocol
conventions. A search box over that field is not a research system.

The original UI accumulated increasingly sophisticated features:

- corpus facets and active filters;
- relay pulse and trending views;
- deduplication and pagination;
- blocking by pubkey and name substring;
- follow lists;
- search versus relay-explorer separation;
- query composition;
- account and note inspection;
- relationship neighborhoods;
- and explicit investigation state.

Yet the user repeatedly encountered failures of legibility and state:

- a new search retained the old term;
- filters appeared to do nothing;
- selecting an account erased typed input;
- “inspect” and “conversation” did not have clear consequences;
- investigation steps accumulated without meaningful use;
- relay exploration ran at surprising times;
- startup became slow;
- result relevance became difficult to trust;
- and UI operations had no clear global hierarchy.

These were not isolated button bugs. They showed that the application mixed
four concerns in one evolving surface:

1. contacting relays;
2. storing and resolving evidence;
3. deriving research views;
4. deciding what the current interface meant.

The front end made those concerns difficult to reason about independently.

## 2. The first decisive turn: rebuild as a library

Commit `08a5249` introduced the repository-backed research foundation. Soon
after, `8740da5` removed the obsolete Solid prototype: nearly 6,000 lines of
client code and client-specific tests disappeared.

This was the project’s most important strategic decision. The library was not
created because libraries are architecturally fashionable. It was created so
that an agent could operate and test the same capabilities directly, without
depending on an unstable UI or maintaining invisible state in conversational
memory.

The worker/reviewer workflow followed from the same concern. Tasks became
durable files. A fresh worker implemented each task, a fresh reviewer checked
it, and accepted work received its own commit. This addressed a repeated
failure mode of long agent sessions: hidden assumptions and half-remembered
changes accumulated faster than any one context could reliably manage.

The workflow eventually produced tasks 005 through 079. It added useful
discipline:

- one bounded objective per task;
- explicit acceptance and validation;
- a review loop rather than self-certification;
- one commit per accepted task;
- recoverable progress after service failures or power loss;
- and historical evidence about why a change exists.

It also created overhead. The project had to clean completed task residue and
prevent test machinery from shaping production interfaces. The mature rule is
correct: use the workflow for coherent milestones; use direct work for small,
well-understood fixes and experimental caller-side systems.

## 3. Memory and persistence: learning what must survive

The project explored several storage models.

### SQLite

SQLite initially seemed attractive because it provided indexing, repeatable
tests, and a realistic storage boundary. A Turso/browser portability spike
tested whether one SQLite-like model could serve local, server, and browser
contexts.

The result was negative for the intended all-browser future. More importantly,
the project realized that durable persistence was not yet the problem being
solved. Designing a stable schema too early would freeze interpretations that
were still changing.

Tasks 024–026 replaced SQLite with a complete in-memory research memory and
removed obsolete persistence assumptions.

### The three-owner memory model

The eventual model is one of the strongest parts of Nostrarium:

```text
observation buffer  renewable evidence, observations, temporary indexes
evidence archive    deliberately retained source evidence
research notebook   explicit navigator interpretation and memberships
```

These owners have different semantics:

- Buffer evidence may be evicted.
- Archived evidence survives buffer turnover but remains bounded.
- Notebook knowledge may outlive the evidence it references.
- Result handles preserve neither evidence nor conclusions automatically.
- All state disappears when the process ends.

This distinction emerged from real research pressure. A single growing corpus
was not enough: the navigator needed a disposable vessel moving through new
data, while selected evidence and judgments remained available. At the same
time, the system could not silently retain everything.

The current model is an explicit compromise. It is honest and simple enough
for experimentation, but it is not cross-session memory. Temporal vessels,
portable voyages, and durable research artifacts remain blocked until an
explicit export/import or persistence boundary is designed.

## 4. Dynamic JavaScript: the productive scaffold

The persistent JavaScript console was one of the most useful discarded
systems.

It gave the agent:

- a running process;
- direct programmatic access to memory;
- arbitrary combinations of filters, maps, grouping, scoring, and traversal;
- and freedom to discover what operations were actually needed.

Through JavaScript, the project successfully attempted difficult open-ended
tasks: finding musicians, cryptographers, coherent identity groups,
interesting profiles, annoying accounts, and communities hidden beneath spam.
Those trials established a crucial boundary:

- the engine should own generic mechanical facts and transformations;
- the navigator should own research choices and conclusions;
- arbitrary glue should eventually become visible, bounded operations rather
  than hidden executable code.

The console also revealed its own problems:

- arbitrary code was unsafe and unsuitable for a browser boundary;
- every agent could invent a different undocumented workflow;
- output could become enormous;
- important state lived in ad hoc variables;
- and successful research could not be reproduced without preserving the
  script itself.

The mistake was not building JavaScript. The mistake would have been keeping
it after it had taught the project what algebra was required.

## 5. From tasks to algebra

The middle of the history is a long consolidation from special research tasks
into composable operations.

Early APIs encoded activities such as account research, graph expansion, and
conversation exploration. Repeated trials showed that these “helpful”
operations fixed too many choices at once. The navigator wanted the freedom
that JavaScript provided, but through declarative pieces.

The resulting engine has two central view types:

### Subject collections

Collections contain stable Nostr identities—events, accounts, addresses, and
tags—with reasons and provenance. They support identity-level movement,
selection, set operations, and explicit transitions.

### Research relations

Relations contain bounded rows combining subjects, derived values, source
resolution, reasons, and field lineage. They support:

- filtering;
- projection;
- sorting;
- grouping and aggregation;
- joins;
- scanning;
- deriving fields;
- slicing;
- exploding nested values;
- balancing;
- and extraction back into stable subjects.

This creates a powerful cycle:

```text
subjects
→ resolve evidence
→ relation rows
→ analyze values
→ extract identities
→ navigate or acquire more evidence
```

The system became most useful when relation-backed `fetch`, pure `extract`,
and explicit `continue` separated three things that “expand” had conflated:

- derive target identities;
- contact relays using current analysis;
- traverse known protocol relationships.

“Expand” was removed rather than endlessly repaired. That decision represents
the project at its best: keep small operations, preserve composition, and
delete vocabulary that obscures what actually happens.

## 6. Persistent declarative session and JSONL

Tasks 036–038 created the persistent declarative session and JSONL adapter.
This replaced the ephemeral CLI and eventually the JavaScript console.

The session owns:

- named result handles;
- one process-local memory;
- a mutation revision;
- command correlation;
- bounded observation;
- and explicit lifecycle.

Its protocol separates:

```text
command success         did the command execute correctly?
research completeness   how much external evidence was obtained?
session mutation        did interpreter-owned state change?
concurrency consistency was the command applied to the observed revision?
```

This distinction corrected an important class of misleading behavior. A relay
operation can execute successfully while resolving only part of its requested
subjects. A failed command normally leaves revision unchanged. External
contact that already occurred is reported rather than pretending transaction
rollback can undo the network.

The observation vocabulary also became precise:

- `show`: what is in this result?
- `inspect`: what evidence currently resolves for this exact subject?
- `explain`: why is this subject in this result?

The JSONL boundary emerged through use rather than foresight, but it became a
good architecture:

- one request and one response per line;
- language-independent structured messages;
- persistent process state;
- easy agent control;
- no arbitrary code execution;
- and a protocol reusable over browser `Worker.postMessage`.

Plans and interactive commands share the same normalized operations. JSONL is
an adapter, not a second engine.

## 7. Honesty became the dominant design principle

Nostrarium’s most distinctive technical property is not its collection
algebra. It is its refusal to flatten uncertainty.

Repeated audits and live trials added:

- separate observation and distinct-event budgets;
- per-relay attempt lifecycle;
- packet, observation, duplicate, and distinct-event counts;
- `NOTICE`, `AUTH`, `CLOSED`, peer-close, EOSE, and NIP-67 visibility;
- explicit partiality and bounds;
- truthful zero-result continuation when a relay fails;
- bounded per-subject outcomes;
- uniform handle summaries;
- visible truncation on intermediate relations;
- provenance omission counts;
- exact filter matching after canonical validation;
- and explicit resolution from buffer, archive, or nowhere.

NIP-11 relay information and NIP-45 count were deliberately implemented as
separate attributed external operations:

- advertised claims are not observed behavior;
- per-relay counts are never summed into fake global truth;
- counting does not silently acquire;
- acquisition does not silently inspect relay metadata.

This discipline also governs content:

- raw valid events remain immutable evidence;
- event roles, formats, conversation roles, links, domains, attachments, and
  media families are derived facts;
- direct self-authored content warnings are excluded from relay acquisition by
  default;
- third-party labels remain attributed evidence rather than automatic policy;
- popularity, trust, “human,” “bot,” “project,” and “interesting” are not
  engine facts.

The cost is verbosity and conceptual density. The project repeatedly had to
improve summaries, contextual schemas, receipts, and omission axes so that
honesty did not become unreadability.

## 8. Runtime neutrality and the stable boundary

Tasks 060–062 moved the core from Node-specific facilities to Web Platform
primitives:

- standard `WebSocket`;
- Web Crypto;
- `TextEncoder`;
- timers and abort signals;
- standard `fetch`.

The same session now works:

- directly in JavaScript;
- through plans;
- through JSONL in Node;
- and through a browser Worker.

Node remains present only where appropriate:

- the JSONL executable;
- the child-process controller transport;
- streams, signals, and CLI diagnostics;
- and the Node test runner.

This is an important distinction. The project did not “remove Node.” It moved
Node out of the research semantics, so browser and CLI adapters share one
engine path.

## 9. Schema and controller: making the engine operable

Once arbitrary JavaScript was removed, a new problem appeared: a generic
agent could not reliably construct commands from prose descriptions.

The schema work aligned runtime normalizers and factual command contracts.
Contextual schema now exposes:

- compatible operations;
- populated and available fields;
- parameter shapes;
- required choices;
- bounds and defaults;
- relationship routes;
- and typed transitions.

Prescriptive `nextOperations` guidance was explicitly removed. Schema reports
what can work; the navigator decides what to do.

The runtime-neutral controller then removed mechanical process friction:

- sequential dispatch;
- caller-independent command IDs;
- bounded transcript;
- compact receipts;
- synchronization through visible `list` and `status` commands;
- catalog staleness;
- strict transport failure handling;
- and one persistent Node child process when needed.

The controller owns no research selection, ranking, or workflow. It is the
stable seam above which different interpretations can coexist.

This boundary has held in live use. The controller solved the agent’s practical
CLI problem without becoming a new domain layer.

## 10. Nostrarium and the vessel idea

On 29 July the project was named Nostrarium and introduced the vessel:

> A coherent caller-side research posture through which a navigator moves,
> senses, judges, and collects.

The ownership rule is the conceptual center:

```text
engine     owns what is true
vessel     owns what is attended to
navigator  owns what is concluded
```

Initial voyage cards tested Depth, Breadth, Skeptic, Archivist, Keyhole,
Correspondent, Echo Chamber, Dowsing Rod, Lighthouse, Drift, and playful
combinations.

Those trials taught several things:

- posture changes journeys;
- breadth and depth produce predictably different movement;
- active invalidation is useful when it does not preload guilt;
- recurrence and rarity are useful instruments, not necessarily vessels;
- artificial blindness can make a posture theatrical rather than useful;
- directed rules can become trapped by local echo;
- random entrances plus navigator curiosity can reach surprising off-axis
  neighborhoods;
- organic follows can pull toward the same incumbent center as curated lists;
- and a voyage only becomes product-relevant when its collection can become
  an artifact.

The cards were useful for the agent but were not a real system. This led to the
next refinement: stop treating prose cards as product objects and build actual
caller-side interpretations.

## 11. The current experimental layer

Commit `9ebfb9c` separated the stable packages from experimental
interpretations.

### Schema composer

Projects factual contextual contracts into controls and composes ordinary
commands. It addresses command-construction friction without choosing a
research direction.

### Field system

Treats one handle as the current field, retains alternatives, and allows
explicit adoption or return. Its ambiguity is productive: it may be a useful
field-centered system, or merely schema composition plus handle history.

### Airlock

Maintains:

- protected Home;
- multiple Questions;
- factual Weather;
- and bounded staged routes advanced one command at a time.

It favors deliberation and safe return. Hybrid use exposed and corrected two
Airlock honesty defects: bounded histogram facts had been described as global
dominance, and adopting a reference overwrote Home’s reason.

### Pinball

Maintains:

- a protected Table;
- several Curiosities;
- a moving Ball;
- recent Collisions.

Every successful one-command hit moves the Ball. It produced the most reactive
and playful research rhythm, quickly moving from kind gravity into unfamiliar
event kinds.

### Darkroom

Maintains:

- fixed Ground;
- multiple Questions;
- bounded Negatives containing paired A/B exposures.

It is not a navigator in the same sense. It changes framing while keeping the
source still. Media versus non-media trials made differences visible without
classifying their meaning.

### Hybrid voyage

The first attempt to combine Airlock, Pinball, and Darkroom disproved an
overconfident conclusion that combination would necessarily create a bloated
universal composer.

The combination was simple because it exchanged ordinary handles:

```text
Airlock protects Home
→ Pinball exposes kind gravity
→ Darkroom compares dominant traffic with kind 1
→ both exposures return to Airlock as references
```

The controls remained separate. Combination happened through shared state and
mode changes rather than a master menu.

### Cock and Balls

The latest experiment made the metaphor operational:

- one protected Root;
- two independently named bounded reservoirs;
- one current Tip;
- a visible retractable Shaft;
- one-command Thrust;
- explicit Pull into either reservoir.

The live trial separated dominant and rare event kinds mechanically, but both
reservoirs collected variants of the same machine-signaling ecology. This is a
good negative result. Separate storage and different labels do not guarantee
meaningful semantic difference.

## 12. What the project has achieved

### A real research substrate

The system can start from a random bounded field and support sustained
exploration through notes, accounts, addresses, tags, relations, content,
media, threads, references, and relay evidence.

### One coherent execution path

Direct calls, plans, sessions, JSONL, browser Workers, and controller clients
do not implement parallel meanings of the same operation.

### Strong evidence ownership

Immutable source events, relay observations, derived views, archives,
notebook knowledge, and handles are not conflated.

### Agent operability without arbitrary code

Contextual schema, structured errors, compact receipts, persistent handles,
and bounded observations have recovered most of the practical usefulness of
the JavaScript console.

### Productive experimental freedom

The stable core no longer needs to absorb every new metaphor. Disposable
systems can contradict, combine, fail, and be deleted without migrating the
engine.

### A disciplined epistemology

The engine reports what happened and what is missing. It does not silently
turn activity into quality, relay overlap into completeness, metadata into
identity truth, or curation into trust.

## 13. What remains weak or unresolved

### Human interaction is still largely conceptual

The current systems are JavaScript APIs and live harnesses. They prove that
different control arrangements are possible, but not that a human can use
them comfortably. The original UI problem has been postponed intelligently,
not solved.

### The experimental vocabulary is proliferating

Field, vessel, composer, system, instrument, posture, voyage, Home, Table,
Ground, Ball, Negative, Root, Tip, Shaft, and reservoirs all describe useful
facets. Their proliferation is acceptable during exploration, but comparisons
will become difficult unless each experiment states:

- what state it owns;
- what it merely observes;
- how commands are executed;
- what memory is bounded;
- and what evidence would justify keeping it.

### Documentation has begun to drift

`experiments/README.md`, `NEXT-STEPS.md`, and parts of the documentation map
still describe only the schema composer and Field system. They do not yet
reflect Airlock, Pinball, Darkroom, the hybrid, or Cock and Balls. This is not
a runtime defect, but it makes the newest direction harder to understand.

### Some stable modules are large

`memory.js`, `presentation.js`, `interpreter.js`, and `relation.js` carry the
largest implementation surfaces. Previous reviews found their responsibilities
coherent, so size alone is not a reason to split them. They remain the most
likely sites of accidental coupling as capabilities grow.

### Process-local memory is now a real boundary

The absence of persistence protected experimentation from premature schemas.
It will eventually block:

- voyages across days;
- temporal comparison after process death;
- sharing research state;
- reproducible artifact rehydration;
- and human interfaces that users expect to reopen.

That does not mean “add a database now.” It means future persistence must
preserve the distinctions already learned rather than serialize one opaque
session blob.

### Random-field navigation remains environmentally hard

The engine correctly exposes that broad random fields are dominated by
machine protocols, spam, repetition, and a small loud center. No library
operation can make Nostr’s public data clean. The unsolved product problem is
how an instrument helps the navigator move despite that reality without
becoming an automated filter authority.

### The project lacks a settled export boundary

Notebook and archive support collection, and trial documents have exported
small artifacts manually. A generic, attributed, bounded export format has not
been promoted. Collection is therefore stronger inside a process than outside
it.

## 14. The architectural shape today

```text
Public Nostr relays
        │
        ▼
runtime-neutral acquisition
        │
        ▼
process-local research memory
  ├─ observation buffer
  ├─ evidence archive
  └─ research notebook
        │
        ▼
normalized operation executor
  ├─ subject collections
  └─ research relations
        │
        ▼
persistent declarative session
  ├─ named handles
  ├─ revision
  ├─ schema
  └─ bounded observation
        │
        ├──────── browser Worker adapter
        └──────── JSONL adapter
                         │
                         ▼
                 neutral controller
                         │
                         ▼
       disposable systems / composers / instruments
                         │
                         ▼
               human or agent navigator
```

The most important boundary is between the controller and experiments. Below
it, changes require correctness and generality. Above it, changes require
interesting evidence from use.

## 15. Recommended direction

The next phase should not add another engine milestone by default. It should
continue the new experimental method, but with better comparative discipline.

### 1. Keep combining systems

The hybrid voyage showed that combinations can remain light when they exchange
handles rather than merge control surfaces. Try combinations that alter:

- memory shape;
- number of simultaneous positions;
- comparison rhythm;
- retraction and return;
- question handling;
- and collection output.

Do not assume combinations should converge.

### 2. Give each experiment a tiny common observation record

Not a framework or registry. Each live harness should record the same small
facts after a voyage:

- commands executed;
- observation commands versus movement commands;
- handles retained and released;
- evidence placed in notebook or archive;
- moments of explicit navigator judgment;
- construction failures;
- and one sentence about what the arrangement made easier or harder.

This makes experiments comparable without normalizing their character.

### 3. Test semantic difference, not only mechanical success

The Cock and Balls voyage worked mechanically but both reservoirs contained
the same ecology. Future tests should ask:

- Did the arrangement create different evidence?
- Did it merely rename the same evidence?
- Did it produce a new question?
- Did it help the navigator return, contrast, or collect?

### 4. Produce real artifacts periodically

Every few voyages, force collection out of the live process into a bounded
document containing subjects, reasons, provenance references, and uncertainty.
This will reveal whether export needs engine support or only caller-side
formatting.

### 5. Delay UI, but begin noticing visual implications

The experiments already imply different interfaces:

- Airlock suggests stable center plus staged exits.
- Pinball suggests a current position with recent impacts.
- Darkroom suggests side-by-side evidence.
- Cock and Balls suggests a rooted trail with two reservoirs.

Do not build a full client yet. But when an arrangement repeatedly succeeds,
make the smallest visual sketch that tests its spatial claim.

### 6. Update current documentation before further proliferation

The root documentation should acknowledge every active experiment and state
that combination is now an explicit research direction. This is a small
maintenance pass, not a redesign.

## Final conclusion

Nostrarium’s history is not a sequence of failed rewrites. It is a process of
discovering the correct ownership boundaries by building the wrong ownership
boundaries concretely enough to reject them.

The original client proved the product desire.  
The library made the behavior inspectable.  
The JavaScript console discovered the needed freedom.  
The algebra encoded that freedom mechanically.  
The session made it persistent and reproducible.  
The schema made it discoverable.  
The controller made it operable.  
The vessel idea separated attention from truth and judgment.  
The current experiments are discovering how many different research machines
can live above the same evidence substrate.

The engine is no longer the uncertain part. The uncertain part is the
experience of navigation—and that uncertainty is now located in the one layer
where it can be explored cheaply, honestly, and playfully.
