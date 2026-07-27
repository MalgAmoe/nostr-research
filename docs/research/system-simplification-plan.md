# Research system simplification plan

Date: 2026-07-27

Status: completed by workflow tasks 052–056. Retained as implementation history.

Direction: `system-simplification-direction.md`.

## Goal

Make the research system easier to predict, operate, and change without
reducing the freedom of the researcher or pretending that inconsistent Nostr
data can be made authoritative.

The work should consolidate the current system. It should not add another
operation language, persistence layer, UI, automatic classifier, or policy
engine.

## Working rules

- Preserve useful public research capabilities unless an operation is
  demonstrably duplicated or obsolete.
- Prefer one sequential, inspectable operation at a time.
- Keep acquisition, local analysis, observation, and deliberate preservation
  visibly distinct.
- Do not encode researcher judgment as library truth.
- Refactor through public behavior, not through tests of private helpers.
- Keep permanent tests only for public functional boundaries, tricky
  algorithms, and protocol rules.
- Use live trials to evaluate usability and temporary scripts or fixtures to
  investigate migrations.
- Do not begin broad file rearrangement before operation ownership is clear.

## Task 1: operation and state inventory

Produce an authoritative decision table for every current operation and every
state-bearing value.

For each operation record:

- researcher intention;
- accepted input kind;
- produced output kind;
- local or external execution;
- read-only or mutating behavior;
- normalization, validation, and execution locations;
- current callers;
- overlap with other operations;
- keep, merge, lower, rename, or remove decision.

For state, map ownership and lifetime of:

- observation-buffer evidence;
- archived evidence;
- notebook knowledge;
- subject collections;
- research relations;
- acquisition reports;
- session handles.

During this task, reproduce and record the known seam failures:

- mixed conversation to authors;
- inconsistent `event.hasMedia`;
- collection and relation pagination differences;
- scan-row versus distinct-event or distinct-author counts;
- multi-input retrieval starvation;
- incomplete schema guidance;
- PTY command echo interleaving.

Deliverable:

- one inventory document that is detailed enough to drive implementation;
- a short list of confirmed removals and merges;
- a functional baseline showing which public paths currently work or fail.

This task changes no architecture. Small correctness fixes should wait unless
they are necessary to obtain an honest baseline.

## Task 2: one operation model and executor

Create one authoritative route from an operation request to its result.

That route must own or delegate, from one discoverable place:

- canonical operation names;
- input and output kinds;
- normalization;
- validation and preflight;
- local or external classification;
- execution;
- mutation behavior;
- completeness reporting.

Plans, direct library calls, and persistent-session commands must consume the
same normalized operation representation and executor.

At the same time:

- define subject collections as identity, navigation, set, and memory views;
- define research relations as value-analysis tables;
- merge or lower duplicated filter, project, distinct, sort, limit, group, and
  summarize behavior;
- resolve `hydrate` versus profile continuation;
- resolve collection grouping and summarization versus relation aggregation;
- make acquisition and continuation names describe relay access honestly;
- remove obsolete dispatch and validation paths after callers migrate.

Deliverable:

- one predictable operation model;
- one execution path shared by plans and sessions;
- no parallel implementation retained merely for compatibility with this
  experimental frontend.

Verification:

- a small number of public functional tests covering normalized execution,
  result kinds, local/external distinction, and failure without partial
  mutation;
- focused protocol-rule tests only where the rule itself is nontrivial.

## Task 3: clarify memory and result ownership

Reduce the mixed responsibilities in `src/index.js` without creating a wide
framework of shallow modules.

The memory should own:

- canonical evidence and its bounds;
- buffer eviction;
- deliberate archive retention and release;
- stable subject resolution;
- notebook knowledge;
- minimal indexes required to retrieve that state.

It should not own every analytical transformation.

Collection and relation execution should operate over explicit inputs and
return explicit result values. Session handles should refer to those values
without copying the corpus or becoming a second storage model.

This task should also make these rules unambiguous:

- acquisition writes to the observation buffer;
- local operations do not silently fetch;
- release of a handle does not erase evidence;
- archive release does not erase notebook history;
- read-only observation does not mutate the session revision;
- failed commands leave session state unchanged;
- successful partial external outcomes report structured completeness.

Deliverable:

- a smaller and more cohesive memory boundary;
- explicit result ownership and lifecycle;
- repaired pagination, distinct-count, starvation, and media-field behavior
  where the inventory located their true owners.

## Task 4: simplify inspection and interactive use

Keep the JSONL session as a thin adapter over the same executor.

Its responsibilities are limited to:

- named handles;
- caller-owned command correlation;
- session revision and optional revision guards;
- command sequencing and cancellation;
- lifecycle commands;
- stable response envelopes;
- bounded presentation.

Make observation predictable through five explicit modes:

- `preview`: a small representative page of members or rows;
- `summary`: counts and compact characteristics;
- `coverage`: bounds, sources, omissions, unresolved evidence, and partiality;
- `details`: canonical evidence currently known for selected subjects;
- `explain`: provenance and the reason a subject belongs to a result.

Improve contextual discovery so a caller can ask what operations are valid
from the current result and receive useful constraints and examples. Make
relation-to-subject transitions and multi-handle composition explicit.

Remove:

- eager secondary metadata that displaces the requested preview;
- obsolete vocabulary and commands;
- raw-result dumps as the ordinary response;
- duplicated session-side operation semantics;
- PTY output ambiguity that can be removed at the adapter boundary.

Deliverable:

- a concise interactive session that exposes rather than hides corpus limits;
- enough visibility to inspect a bounded pool and choose the next operation;
- no need to write arbitrary JavaScript for ordinary navigation and analysis.

## Task 5: sustained live research and final cleanup

Use the finished system for at least two sequential research sessions:

1. a goal-directed profile search;
2. an open-ended exploration beginning with a bounded recent-event sample.

The trials should assess:

- whether the available evidence is visible;
- whether a result's contents and provenance are understandable;
- whether local and relay-backed work are distinguishable;
- whether bounded, partial, unresolved, and omitted data are visible;
- whether valid next operations are discoverable;
- whether a researcher can move between events, accounts, conversations,
  neighborhoods, collections, and relations without extracting IDs manually;
- whether deliberate preservation and buffer turnover remain understandable;
- whether arbitrary JavaScript is still required, and exactly why.

After the trials:

- remove superseded code, tests, exports, task artifacts, and documentation;
- update the active architecture and usage documentation;
- retain only regression tests justified by stable external behavior or
  protocol correctness;
- record remaining limitations without turning Nostr's ambiguity into a
  library defect.

## Execution order and review gates

The tasks are intentionally sequential:

```text
1. Inventory and baseline
        ↓
2. Operation model and executor
        ↓
3. Memory and result ownership
        ↓
4. Inspection and session use
        ↓
5. Live trials and cleanup
```

Each task should be one workflow task and one reviewed commit. A task is not
complete merely because its code passes tests. Its reviewer must also check
that:

- it removed or consolidated more accidental complexity than it introduced;
- terminology agrees with the active direction document;
- public behavior is verified at a meaningful boundary;
- no compatibility layer was retained without a current caller;
- later tasks have not been implemented prematurely.

Task 1 is the only safe starting point. Its inventory may adjust the exact
boundaries of Tasks 2 and 3, but it should not expand the milestone.

## Completion condition

The milestone is complete when a researcher can answer, without knowing the
implementation:

- What evidence do I have?
- What does this result contain?
- Why is this subject here?
- What can I do next?
- Will that operation use local evidence or contact relays?
- What was bounded, missing, unresolved, or omitted?
- What state is temporary, deliberately preserved, or merely a session handle?

For a maintainer, the equivalent completion condition is:

> Given an input kind and an operation, there is one discoverable definition
> of what is accepted, what executes, what mutates, and what result is
> returned.
