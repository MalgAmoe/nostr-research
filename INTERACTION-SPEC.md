# Nostrarium navigator interaction specification

Status: first product-level interaction specification for experimentation.

## Purpose

This document defines how a navigator can see, manipulate, and move between
engine-backed research places without prescribing a final visual design.

It is not:

- a mockup or styling specification;
- a catalogue of every engine command;
- an Atlas implementation plan;
- a vessel definition;
- a persistence or workspace design; or
- a replacement for the engine, controller, or their contracts.

The specification sits above the neutral controller. It arranges existing
facts and visible commands for a human navigator. Different interfaces may
implement it differently while preserving the same places, evidence, actions,
and decisions.

The central product idea is:

> A result is a working place from which research can continue, not an endpoint
> or a disposable list of cards.

## Ownership boundary

The existing project boundary remains unchanged:

```text
engine     owns what is true
interface  owns what is visible and operable now
navigator  owns direction, judgment, and conclusion
```

The interface may arrange factual engine results, group mechanically
applicable controls, and compile a navigator action into visible commands. It
must not rank subjects by its own authority, recommend a next action, infer
quality or trust, or contact a relay without an explicit navigator action.

## Interaction vocabulary

### Place

A **place** is a named UI reference to an ordinary engine result handle and the
minimal interaction state required to revisit it.

A place may refer to events, accounts, addresses, a relation, or another real
engine result kind. It does not copy or own canonical evidence. At minimum it
retains:

- the ordinary result handle;
- the session revision at which that handle was installed;
- its result kind and counting unit when known;
- a navigator-visible label and origin;
- the operation or acquisition that produced it;
- attributed snapshots of explicitly requested observations;
- projection and local paging position; and
- declared bounds, partiality, and evidence-resolution facts.

Every place-owned handle ID is allocated once and is never replaced. Re-running
an operation creates a new handle and therefore a new place. This prevents a
place from silently changing meaning when the session supports explicit handle
replacement. Observation snapshots retain the command, response, and observed
session revision that supplied their facts; they are not a second authoritative
evidence model.

The interface must not call a result complete merely because the command that
created it completed. Attempt status, evidence resolution, boundedness, and
exhaustiveness remain separate.

### Ground

**Ground** is the place from which the current line of research is understood.
Executing an explicit initial acquisition installs its successful result as
both Ground and current place; no second admission click is required. Ground
then remains stable until the navigator explicitly chooses **Replace Ground**
with another existing place or newly executed acquisition. Ground is not a
special engine result and does not prevent branching or moving elsewhere.

### Branch

A **branch** is another place produced from a known place by a visible local or
external operation. It retains its origin and the navigator's reason for
creating or keeping it.

Branches are navigation state, not preserved evidence. Releasing a branch and
preserving evidence are different actions.

An explicitly activated place-producing door installs its successful handle as
a branch and makes that branch the current place. Ground remains unchanged.
Returning to Ground or another branch changes only the current place.

### Subject

A **subject** retains the engine's precise meaning: one exact event, account,
address, or tag. Selecting a subject changes the subject surface; it does not
replace or mutate the current place. Domains, relay outcomes, aggregate values,
and relation rows may also be selected as factual items in that surface, but the
interface does not falsely promote them to stable Nostr subjects.

### Facet

A **facet** is a bounded factual description derived from the current place,
such as an account, tag, event kind, media fact, domain, relay observation, or
time bucket.

A facet is an overlap point rather than a one-purpose filter. Depending on its
type and the available engine contract, the same facet may support:

- narrowing the current place locally;
- opening the facet as a subject;
- navigating to a related place;
- adding a constraint to an acquisition draft;
- comparing branches; or
- retaining a navigator judgment or collection membership.

The interface exposes only actions mechanically supported by the facet and the
current result. It does not choose one as the preferred action.

Facet counts describe the bounded input from which they were derived. They do
not imply network-wide frequency or importance.

### Projection

A **projection** is one visual representation of a place: for example a note
stream, account list, table, conversation, media gallery, timeline, or
structural relation view.

Changing between projections over already-returned facts is presentation only.
When a projection requires an engine transformation, the interface must make
that local command visible and retain its resulting handle rather than
pretending that it was a cosmetic view switch. An observation produces no new
handle: it remains attached to its source handle as an attributed command and
bounded response snapshot.

### Door

A **door** is an explicit, evidence-bearing action from a subject, facet, or
place. A door states what it will do and whether it is local or external. It is
an available route, never a recommendation.

Its result type is explicit:

- a **place door** produces a handle, installs a branch, and makes it current;
- an **enrichment door** produces a supporting handle and attaches its bounded
  observations to the selected subject without changing place;
- an **observation door** updates the selected subject or current place with an
  attributed bounded observation snapshot and creates no navigation entry;
- a **draft door** prepares editable command parameters and executes nothing;
- a **mutation door** records notebook/archive state only after explicit
  confirmation and does not move automatically.

### Acquisition draft

An **acquisition draft** is an editable, unexecuted description of a relay
request. It contains visible relay selection, engine-shaped Nostr constraints,
and bounds. It is not described as normalized until the engine executes it and
returns the effective normalized request.

Preparing a draft never contacts relays. Executing it is a separate explicit
action. A draft remains independent of current place and subject selection, so
opening a note or account cannot erase or silently rewrite it.

## Workspace responsibilities

The interaction has three primary responsibilities. A wide layout may render
them as three columns; a narrow layout may stack, overlay, or switch among
them. Their meaning must not depend on their position.

### Context and controls

This region answers:

- Where did the current place come from?
- What local constraints are active?
- What factual facets are visible?
- Which Ground and branches can be revisited?
- What relay request is currently drafted but not executed?

It contains acquisition construction, active local constraints, facets, and
the bounded place structure. It must visibly distinguish:

- local operations over resident memory;
- external operations that contact relays;
- an edited draft from the request that produced the current place; and
- current place state from session-wide memory state.

### Current place

This region answers:

- What kind of result am I looking at?
- How many subjects or rows are represented, and under which bounds?
- What can I actually see in the current projection?
- Which subject is selected?

Its orientation remains visible while scrolling:

- place label and origin;
- result kind and counting unit;
- returned versus omitted or truncated material;
- resolved and unresolved evidence when declared;
- local versus externally acquired origin; and
- warnings or partiality that affect interpretation.

The current projection occupies the main content area. Notes and accounts are
rendered as human-readable objects first, with their exact evidence still
accessible.

### Selected subject

This region answers:

- What is this object?
- What exact evidence supports what is displayed?
- Where was it observed?
- Why is it present here?
- Which explicit doors are available from it?

For a note, it may show readable content, normalized attachments, protocol
relationships, tags, provenance, inclusion reasons, and bounded canonical
evidence with declared omissions.
For an account, it may show the exact public key, current profile claims when
resolved, authored evidence, referenced domains, relationships, and provenance.

Profile metadata is presented as an attributed relay-observed claim, not an
identity fact. External media bytes remain separately and explicitly loaded.

## Global conditions

The interface needs a compact, persistent conditions surface independent of
the three workspace responsibilities. It may be a header or status strip.

It exposes only already-known facts that materially affect current decisions:

- external activity and cancellation availability, including an explicit
  **Unavailable** state when the adapter exposes no cancellation boundary;
- latest warnings and external-attempt status;
- buffer, archive, notebook, and handle pressure when observed;
- current relay set; and
- whether the displayed place or cached catalogue is stale.

It must not start background acquisition merely to keep these facts fresh.
The first vertical slice requires only latest external status, warnings, and
displayed relay targets. Complete pressure and catalogue-staleness
instrumentation remains a later experiment because observing it requires
additional explicit commands.

## Interaction rules

### Selection is not movement

Selecting a visible note, account, or tag opens it in the subject surface.
Selecting another factual item may open the same surface without claiming that
the item is a Nostr subject. The current place, its projection, paging position,
facets, and acquisition draft remain unchanged.

The explicit selection gesture may immediately authorize the bounded local
`show`/`inspect`/`explain` observations required to populate that surface. The
interface labels selection as local, contacts no relay, records the commands and
responses, and makes the compiled commands inspectable. It does not require a
second ceremonial “observe” click.

Movement occurs only when the navigator explicitly takes a door or activates a
branch.

### Local and external actions never share an ambiguous control

Every executable action states one of:

- **Local**: uses current process memory and contacts no relay.
- **Relay request**: contacts the displayed relay set with displayed bounds.
- **Notebook/archive mutation**: records interpretation or preserves evidence.
- **Interface-only**: changes focus, projection, or place arrangement without
  issuing an engine command.

A single visual group may contain several categories, but its action labels and
confirmation state must preserve the distinction.

### Facets support explicit overlapping uses

Selecting a facet does not silently filter the field. It exposes the supported
uses for that facet in the current context.

The two essential uses are:

1. **Filter this place** — execute a local operation over the current handle
   and create a branch.
2. **Prepare relay research** — compile the facet into an acquisition draft,
   foreground the draft, and wait for the navigator to edit and execute it.

The second use is offered only when the facet can be represented honestly in a
relay filter or other supported external contract. Unsupported facets remain
useful locally rather than being approximated.

Preparing relay research replaces the acquisition draft with the visibly
compiled parameters. It does not merge hidden remnants of an earlier draft,
execute automatically, or replace the current place.

### Commands remain inspectable

Common controls may hide JSON syntax but not behavior. Their ordinary command
or command sequence remains inspectable. A familiar, labelled local action may
execute directly after the navigator's gesture; an external request or mutation
must expose its effective target and bounds before confirmation. Complex or
unfamiliar controls should be derived from contextual schema rather than a
second handwritten operation contract.

The interface may keep common, verified command templates. It must not create
hidden procedures whose intermediate operations, bounds, or handles disappear.

### Place history is not engine undo

Back, forward, Ground, and branch selection restore retained place references
and their interface state. Each place retains a UI place ID, immutable handle
ID, installation revision, Ground/branch role, origin command and receipt,
navigator reason, projection, attributed observation snapshots, local page
offset, selected subject or item, selected facet, and visible local constraints.
They do not undo acquisitions, notebook mutations, archive preservation, buffer
eviction, or session revision.

If a handle has been released or its evidence has become unresolved, the
restored place reports that condition rather than reconstructing it silently.

Removing a place from the interface removes only that place reference. Releasing
its engine handle is a separate explicit lifecycle action because another place,
question, or caller may still refer to the same handle.

### Clear and reset are different

The navigator must be able to return to a visually clean starting surface
without deleting process memory. Resetting the session or memory is a separate,
explicitly destructive action with a clear description of what will be lost.

### Unavailable evidence stays visible as unavailable

No card or panel silently turns unresolved, omitted, truncated, unrequested,
or unsupported material into an empty fact. Examples include:

- an unresolved account is not an account with no profile;
- zero replies from responsive relays are not proof of no replies globally;
- a size-bounded preview is not the complete result;
- an absent facet is not a zero-frequency facet unless the engine established
  that count; and
- a completed relay attempt is not exhaustive network evidence.

## Places and projections

The interaction model recognizes four primary place kinds without inventing
UI-only data models. The first vertical slice implements only the subset named
in its own requirements.

### Note places

Primary projections:

- readable stream;
- compact table;
- media-bearing notes; and
- conversation when an explicit relationship result supports it.

Note rendering supports links, Nostr references, hashtags, normalized images,
video, audio, and access to bounded canonical tags/event facts with declared
omissions. Rendering never mutates the canonical event. Acquisition continues
to apply the configured default content-warning exclusion; reliable per-event
warning display is not required until the engine exposes that factual field
through its public observation boundary.

### Account places

Primary projections:

- account list with resolved/unresolved state;
- profile-oriented cards; and
- account evidence table.

Hydration is an explicit relay action. An account remains navigable by public
key before profile metadata resolves.

### Relation places

Primary projections:

- bounded rows;
- field/schema orientation;
- mechanical aggregates; and
- transitions back to typed subjects when lineage supports them.

Relation output should not be coerced into note or account cards. The interface
may offer an explicit exit from a relation field into extracted subjects.

### Relay places

Relay information, count reports, acquisition coverage, and pairwise observed
differences are factual source views. Advertised NIP-11 support, NIP-45 count
responses, and observed acquisition behavior remain separate. The interface
does not compute a relay quality or trust score.

Relay places describe the complete interaction model but are deferred from the
first vertical slice. That slice shows relay targets, request bounds, and
returned attempt coverage as conditions attached to acquisitions.

## Capability mapping

The interaction model arranges existing lower-layer capabilities. The table is
illustrative rather than exhaustive.

| Navigator intent | Existing capability | Effect |
| --- | --- | --- |
| Contact a bounded field | `acquire` or an explicit plan | External; may add observations and events |
| Narrow the current place | `select`, `filter`, `scan`, `limit`, or compatible relation operation | Local branch |
| See accounts behind notes | `move`, `extract`, `relate` | Local place |
| Resolve profile claims | `hydrate` | Explicit external request |
| Follow a known relationship locally | `move` or local `continue` | Local place |
| Ask relays for relationship evidence | relay-backed `continue` or `fetch` | Explicit external request |
| Understand why something is present | `explain` | Local observation |
| Inspect exact known evidence | `inspect` | Local observation |
| Change bounded evidence density | `show` modes and paging | Local observation |
| Derive facets or structural views | `relate`, `explode`, `project`, `derive`, `aggregate`, `sort` | Local relation place |
| Compare places | set operations or `compare` | Local place |
| Record navigator interpretation | notebook commands | Explicit notebook mutation |
| Preserve source evidence | `preserve` | Explicit archive mutation |
| Inspect relay claims or counts | `relay-info`, `relay-count` | External factual report |
| Dispose of an engine handle | `release` | Explicit handle lifecycle only |

The interface does not assign operations permanently to “Search,” “Navigate,”
“Analyze,” or “Collect.” The same generic operation may serve several moments.

## First experimental vertical slice

The first implementation should prove one complete loop rather than broad
feature coverage:

```text
editable relay acquisition
→ engine-backed note place
→ bounded account-frequency facets
→ local account-note branch
→ return to Ground
→ same account compiled into an editable relay draft
→ selected note evidence
→ selected author
→ explicit profile hydration
→ explicit authored-notes acquisition
→ authored-notes place
→ return to any retained place
```

The only required operational facet for this tracer slice is **account
frequency within Ground**. Tags, kinds, media/content facts, domains, and relay
facets remain immediate evaluation candidates after the overlap interaction is
proven once.

The account facet is derived through ordinary bounded commands:

```text
Ground events
→ relate
→ aggregate by event.author as account, count as noteCount
→ sort by noteCount descending
→ bounded account facet rows
```

The exact public command shape, with caller-allocated unique IDs, is:

```jsonl
{"command":"relate","input":"<ground-handle>","resultId":"<ground-rows>"}
{"command":"aggregate","input":"<ground-rows>","parameters":{"by":[{"field":"event.author","name":"account"}],"aggregations":[{"name":"noteCount","operation":"count"}],"limit":1000},"resultId":"<account-facets>"}
{"command":"sort","input":"<account-facets>","parameters":{"by":[{"field":"noteCount","direction":"descending"}]},"resultId":"<ranked-account-facets>"}
```

Every displayed facet record retains its Ground place and handle, deriving
commands and relation handles, account value, `noteCount` row count, counting
unit, lineage, bounds, truncation, and omissions.

Its two required overlapping uses are:

1. **Notes here by this account** — filter the Ground event relation where
   `event.author` equals the selected public key, extract the source
   `subject.id` with event lineage, install the resulting event handle as a
   branch, and make it current.
2. **Research this account on relays** — prepare, but do not execute, an
   independent acquisition draft whose visible NIP-01 filter contains
   `authors: [publicKey]` and `kinds: [1]`.

The frequency is evidence only about the bounded Ground. It is not an activity,
importance, human, spam, or quality classification.

The corresponding local branch commands are:

```jsonl
{"command":"filter","input":"<ground-rows>","parameters":{"where":{"field":"event.author","equals":"<public-key>"},"limit":1000},"resultId":"<account-note-rows>"}
{"command":"extract","input":"<account-note-rows>","parameters":{"field":"subject.id","subjectType":"event","limit":1000},"resultId":"<account-notes-here>"}
```

The relay-research action prepares this engine-shaped command draft without a
`commandId` or `resultId`. At execution, the controller allocates `commandId`
and the interface allocates a new, never-replaced `resultId`:

```json
{"command":"acquire","parameters":{"relays":["<visible-relay>"],"filter":{"authors":["<public-key>"],"kinds":[1]},"timeoutMs":10000,"observationLimit":100,"distinctEventLimit":100,"concurrency":4}}
```

Required subject surfaces:

- readable note evidence; and
- account identity plus optional profile claims.

Required place projections:

- note stream;
- account list; and
- one bounded account-facet table sufficient to expose how the facet was
  derived.

Executing the initial visible search installs the returned place as both Ground
and current place. A place-producing door then installs and opens a branch
immediately because the navigator already chose that movement; it does not add
another pending-placement confirmation.

Profile hydration and authored-note acquisition each use a dedicated external
action draft. The draft is prefilled from the current place's producing relay
set and operation-appropriate engine defaults, but it remains independent of
the main acquisition draft. It displays exact relays and bounds and can be
edited before execution. Profile hydration is an enrichment door: its
supporting handle and bounded observations attach to the selected account
without changing place. Authored-note acquisition is a place door and therefore
creates and opens a branch.

The slice must demonstrate that:

- selecting a subject never erases query text or changes the place;
- local filtering never contacts a relay;
- preparing broader research never executes automatically;
- the compiled acquisition draft is visible and editable;
- every derived place retains its origin, bounds, and counting unit;
- backtracking restores place and selection state without pretending to undo
  engine state;
- notes and accounts remain useful even when evidence is unresolved; and
- no Atlas-specific engine operation is required.

## Second experimental vertical slice

The first slice proved place identity, branching, subject selection, local
facets, and explicit external actions. The second slice should make those
mechanics useful for reading and traversing Nostr. It is not a request for a
universal workbench or broad feature parity.

The complete loop is:

```text
read a rich note in Ground
→ select it without moving
→ see its exact author and typed relationship evidence
→ open an already-known subject or a bounded local relationship branch
→ optionally prepare and execute a visible relay relationship request
→ read the resulting note place
→ return with the former place, selection, and projection intact
```

### Rich note rendering

The stream and gallery render already-exposed factual content without rewriting
the canonical event. The required presentation is:

- readable multiline text;
- safe clickable web links;
- visible hashtags and Nostr references;
- normalized image, video, and audio attachments with URL and declared factual
  metadata when available; and
- reply, quote, repost, or other content-role context when the public event
  facts expose it.

External media bytes are never loaded merely because a note entered a place or
became visible. Every image, video, or audio attachment first appears as a
bounded factual placeholder. The navigator explicitly loads each external
resource. A failed load remains a visible failed external observation rather
than disappearing. Rendering does not execute engine commands and does not
infer safety, quality, authorship, or intent.

### Note doors

The selected-note surface exposes only routes supported by retained typed
evidence or the contextual continuation contract:

- exact author account;
- reply parent and ancestors;
- replies;
- quoted events;
- mentioned or otherwise referenced events;
- mentioned accounts; and
- referenced addresses.

Opening one already-known exact subject is selection, not movement. Opening a
set of subjects installs and opens a new branch backed by an ordinary handle.
Unresolved subjects remain visible as unresolved and may still be navigable by
their stable identifier.

Local relationship doors use ordinary `move` or `continue` commands with
`source: "local"`, contact no relay, and disclose their commands. A local zero
is only a resident-memory result.

Relay-backed relationship doors use ordinary `continue` with
`source: "relays"`. Before execution, Atlas displays a dedicated editable
draft containing the exact relationship, relay targets, event limit, timeout,
observation limit, distinct-event limit, concurrency, and warning exclusion.
Executing the draft installs and opens the returned event handle as a branch,
including when its bounded preview is empty. Relay completion and network
exhaustiveness remain separate.

Atlas may arrange the routes compactly, but it must not recommend one, execute
several automatically, merge local and relay behavior under one ambiguous
control, or hide intermediate result handles.

### Attributed account presence

When explicit hydration has resolved profile claims, Atlas may use the
relay-observed `display_name`/`name` and picture in note and account
presentation. The exact public key remains available and the UI distinguishes
the claim from canonical account identity.

Atlas may provide one explicit bounded **Resolve authors in this place**
action. It composes the current event handle through ordinary `move` to
`authors`, then `hydrate` for kind `0` using visible relays and bounds. It
executes no request until the navigator confirms the draft. Resolved,
unresolved, partial, and failed counts remain visible. It does not hydrate on
acquisition, selection, scrolling, or branch activation.

Observed profile claims may enrich presentation across retained places in the
same process, but they do not alter event evidence, subject identity, or the
research notebook.

### Second-slice acceptance

The slice is complete when real-relay voyages demonstrate that:

- a media-bearing note remains readable before any external media loads;
- loading one attachment does not load other attachments or move place;
- selecting a displayed author opens the exact account without contacting a
  relay;
- local relationship movement contacts no relay and reports resident-memory
  limits honestly;
- relay-backed replies or conversation research exposes and executes one
  editable bounded draft, then opens a branch;
- already-resolved profile claims appear consistently in note and account
  presentation with attribution and public-key fallback;
- returning to Ground restores its projection, selection, facets, constraints,
  and media-load state; and
- no engine/controller change or Atlas-specific operation was needed.

## Evidence inherited from earlier experiments

This specification is informed by, but does not require importing:

- **Atlas**: browser Worker/controller viability, explicit relay boundaries,
  retained field handles, note-to-account navigation, and local history;
- **Evidence Desk**: strong note/account evidence frames and separate summary,
  preview, details, explain, and coverage senses;
- **Field Board**: visible Ground, bounded branches, caller reasons, and neutral
  contrasts;
- **Schema Composer**: factual construction of unfamiliar commands without
  inventing engine semantics; and
- **Voyage System Slice**: explicit staged execution, pending placement, shared
  focus, loose questions, and ordinary-handle interchange.

These experiments remain independent evidence. The first implementation may
reuse code only where the dependency genuinely simplifies the result. It must
not create a framework whose purpose is to make every experiment fit together.

## Deliberate exclusions

The specification does not authorize:

- automatic background acquisition, hydration, traversal, retry, or relay
  substitution;
- hidden query broadening or mutation;
- a chronological activity trail as the primary navigation model;
- automatic admission, rejection, or retry of a field based on inspecting its
  contents after acquisition;
- trust, popularity, bot, quality, or relay scores;
- next-action recommendations;
- a universal catalogue of every command in every context;
- durable workspace/session serialization;
- fake or bundled Nostr data;
- autonomous vessel behavior;
- every click becoming notebook or archive state; or
- resurrection of the old Solid application or its state architecture.

Saved searches, durable collections, moderation lists, deep comparisons, graph
visualization, and export may be explored later. They are not required to prove
this interaction model.

## Open presentation decisions

The following remain intentionally open for experimentation:

- exact layout and responsive behavior;
- whether external acquisition, current field, and relay source views use tabs
  or coexist in one workspace;
- which facets appear by default and how their computation is bounded;
- how many branches remain simultaneously visible;
- whether a subject inspector is pinned, overlaid, or routed on small screens;
- the visual grammar for local, external, notebook, and interface-only actions;
- which common command templates deserve direct controls; and
- how much raw schema and command detail is shown by default.

## Evaluation

The first slice should be tested through real voyages rather than judged by
feature count. Record:

- whether the navigator can always identify the current place and Ground;
- whether rows, subjects, matches, and events are confused;
- whether local and relay-backed actions are ever mistaken for each other;
- whether facets actually support useful overlapping actions;
- how often raw commands or schema are needed;
- whether the subject surface provides enough evidence to choose a door;
- whether branch history remains understandable after sustained navigation;
- which controls are repeatedly used, ignored, or bypassed; and
- whether the interface enables journeys that the current Atlas slice makes
  unnecessarily difficult.

Success is not the absence of lower-level escape. Success means the common
research loop is understandable and useful while the complete system remains
available underneath.

The specification is at the correct level if two substantially different
interfaces can implement it while preserving the same engine-backed places,
explicit actions, evidence boundaries, and navigator ownership.
