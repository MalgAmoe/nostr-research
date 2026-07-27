# Research system simplification direction

Date: 2026-07-27

Status: current direction for the next architectural work.

## Purpose

The next milestone is to make the Nostr research system more predictable,
simpler to reason about, and easier to use.

This does not mean making Nostr itself clean or coherent. Nostr contains:

- incomplete and conflicting evidence;
- inconsistent client behavior;
- machine and human activity in the same event space;
- malformed or unusually encoded data;
- different relay subsets;
- missing profiles and relationships;
- spam, reposts, bots, and application events.

The library cannot repair those conditions and should not hide them by silently
rewriting evidence.

The library’s responsibility is narrower:

> Preserve messy Nostr evidence faithfully, expose uncertainty and provenance,
> and provide predictable operations for navigating and researching it.

## Current assessment

The system has a credible architectural core:

- a bounded process-local research memory;
- immutable canonical Nostr evidence;
- stable subject identity;
- explicit provenance;
- subject collections;
- composable research relations;
- local and relay-backed operations;
- a persistent declarative session;
- caller-authored notebook judgments;
- named memberships;
- explicitly preserved evidence.

The main architectural problem is not missing capability. It is that some of
our own concepts and execution paths overlap.

The most important example is the existence of two partially overlapping
analysis systems:

- subject collections implement operations such as `filter`, `project`,
  `distinct`, `sort`, `limit`, `group`, and `summarize`;
- research relations implement several of the same operations, together with
  `scan`, `aggregate`, `join`, `derive`, and related analysis.

The dispatcher changes behavior according to input kind. Validation, field
semantics, result-kind calculation, execution, schema generation, session
handling, and presentation are consequently distributed across several
modules.

This makes the system harder to predict and maintain than necessary.

## Desired model

The system should be understandable through four principal domain values.

### Evidence memory

Memory owns:

- the renewable observation buffer;
- deliberately preserved evidence;
- the research notebook;
- derived indexes needed to resolve and navigate evidence.

### Subject collections

Subject collections own:

- stable event, account, or relationship identity;
- result-membership reasons;
- provenance references;
- bounded identity-oriented navigation state.

### Research relations

Research relations own:

- values derived from subjects and current evidence;
- filtering and projection;
- scanning;
- ordering;
- aggregation;
- grouping and other analytical transformations.

Relations must remain connected to stable subjects and must not silently become
an evidence archive.

### Acquisition reports

Acquisition reports describe one explicit bounded external attempt:

- exact request;
- contacted relays;
- relay outcomes;
- observations;
- duplicates;
- distinct canonical events;
- bounds reached;
- effects on the working corpus.

The execution model should distinguish only:

- local operations over current memory;
- external operations that may add evidence and return partial coverage.

Plans, individual session commands, JSONL, and future adapters should all use
the same normalized operation executor.

## First architectural objective: one authoritative operation path

An operation currently requires coordinated knowledge across modules including:

- `operations.js`;
- `plan.js`;
- `interpreter.js`;
- `index.js`;
- `relation.js`;
- presentation and schema code.

The system should instead have one authoritative operation module that owns or
delegates:

- accepted input kind;
- parameter normalization;
- validation and preflight;
- output kind;
- local or external status;
- execution;
- mutation reporting;
- completeness reporting.

Plans and interactive commands must invoke the same operation representation
and executor. The session must not reinterpret operation semantics.

The expected benefit is locality:

> Understanding or changing one operation should require inspecting one
> authoritative path rather than coordinating several parallel dispatchers.

## Second architectural objective: distinct jobs for collections and relations

Subject collections and research relations are both useful. They should not
maintain two versions of the same analytical language.

The likely division is:

### Subject collections

Use collections for identity-oriented work:

- selection;
- bounded picking or sampling;
- graph movement;
- set composition;
- remembering judgments;
- remembering named membership;
- preservation.

### Research relations

Use relations for value-oriented work:

- field filtering;
- projection;
- distinct values;
- sorting;
- scanning;
- grouping;
- aggregation;
- joining;
- derived values;
- balanced analytical views.

Before changing code, every operation should be inventoried with:

- research intention;
- accepted input;
- output;
- local or external behavior;
- current implementation;
- overlapping operation;
- decision to keep, merge, lower into another operation, or remove.

Because the project is experimental, obsolete operations do not need
compatibility aliases.

## Third architectural objective: memory owns state, not every operation

The current `index.js` implementation contains memory ownership together with:

- collection transformations;
- field semantics;
- validators;
- schema construction;
- notebook and membership operations;
- archive behavior;
- relationship navigation;
- presentation projections.

The public memory module should remain deep and small. Its implementation can
be reorganized internally so that:

- memory state and evidence resolution remain together;
- collection and relation algebra are localized;
- field semantics have one definition;
- schema is derived from authoritative operation and field definitions;
- notebook and archive ownership remain explicit.

This is not a proposal for many new public interfaces. It is an internal
locality improvement.

## Fourth architectural objective: a thin session

The declarative session should own:

- named handles;
- session revision;
- command correlation;
- sequential execution;
- cancellation;
- lifecycle;
- stable response envelopes.

The session should not own independent operation semantics.

It should:

1. validate the command envelope;
2. resolve handles;
3. normalize the requested operation;
4. call the authoritative executor;
5. install the resulting handle;
6. return the operation outcome in a stable response envelope.

Mutation, completeness, and result-kind rules should not be duplicated between
single commands and plans.

## Fifth architectural objective: predictable observation

Presentation should prioritize the information needed for the next research
decision.

The current implementation often computes extensive facets, freshness,
orientation, provenance, relationship summaries, and corpus information before
applying a response-size bound.

Observation should instead expose explicit projections.

### Preview

Show a bounded set of subjects or rows with only the evidence needed to choose
the next operation.

### Summary

Show:

- result kind;
- cardinality;
- meaningful distinct counts;
- time and operation bounds;
- truncation;
- completeness.

### Coverage

Show:

- relay outcomes;
- unresolved subjects;
- omitted inputs;
- bounds reached;
- evidence resolution.

### Details

Show comprehensive diagnostics only when requested.

### Explain

Show why one subject belongs to one result without repeating every general
facet of the collection.

Expensive secondary analysis should not be performed for a normal preview.

## Command vocabulary review

The current public vocabulary contains overlapping candidates that should be
reviewed rather than preserved automatically.

Examples include:

- `hydrate` and continuation through `profiles`;
- collection `group` or `summarize` and relation aggregation;
- collection and relation versions of `filter`, `project`, `distinct`, `sort`,
  and `limit`;
- relation-directed `fetch` or `expand` and their relationship to acquisition
  and continuation.

The goal is not the smallest possible command count. The goal is one
predictable meaning for each command.

## Genuine system problems to fix

The following are problems in our implementation rather than unavoidable Nostr
mess:

- mixed conversation `move → authors` can return an internal error;
- `event.hasMedia` can disagree with visible event media evidence;
- collection and relation pagination behave differently;
- scan reports match rows without making distinct events and authors clear;
- operation schemas omit useful parameter contracts;
- multi-input retrieval can be dominated by one prolific input;
- JSONL PTY input can be echoed and interleaved with responses;
- historical examples contain obsolete commands;
- validation errors often identify invalid input without showing the accepted
  shape;
- presentation can compute and prioritize secondary metadata over the actual
  preview.

These should be addressed while simplifying the relevant execution paths.

## Problems the system should expose, not “fix”

The system must not take responsibility for:

- making a relay sample globally representative;
- repairing incorrectly published source events;
- forcing clients to agree on optional conventions;
- deciding whether an account is a person, project, bot, or application;
- deciding what is interesting;
- producing a universal quality or expertise score;
- treating missing bounded evidence as proof of absence;
- eliminating human interpretation from research.

The correct response to these conditions is:

- faithful evidence;
- provenance;
- explicit bounds;
- visible uncertainty;
- local exclusion and filtering;
- alternative navigation paths;
- caller-owned judgment.

## Work structure

The simplification should be performed in two substantial passes rather than
many small disconnected refactors.

### Pass 1: simplify the engine

1. Inventory all current operations.
2. Decide the responsibilities of subject collections and research relations.
3. Establish one normalized operation path.
4. Remove duplicate analytical implementations.
5. Reduce the mixed responsibilities in `index.js`.
6. Make plans and sessions use the same executor.
7. Fix correctness problems encountered at these seams.
8. Keep permanent verification focused on public functional behavior and
   stable protocol rules.

### Pass 2: simplify usage

1. Make ordinary observation concise and predictable.
2. Add contextual operation and schema discovery.
3. Make relation-to-subject transitions obvious.
4. Expose evidence-window and completeness limits prominently.
5. Improve conversation and neighborhood inspection.
6. Simplify multi-handle composition and lifecycle.
7. Remove obsolete vocabulary and documentation.
8. Repeat sustained live research trials.

## Evaluation criteria

A change improves the system if it makes one or more of these questions easier
to answer:

- What evidence is currently available?
- What does this result contain?
- Why is this subject present?
- Which parts are local and which required relay access?
- What was bounded, partial, unresolved, or omitted?
- What operations are valid from this result?
- What state will survive buffer eviction?
- Where is one operation normalized and executed?
- Can the behavior be verified through a public functional seam?

A change is suspect if it:

- encodes provisional judgment as truth;
- creates another parallel operation language;
- duplicates existing semantics;
- hides external acquisition;
- makes state mutation implicit;
- automatically retains evidence;
- introduces a seam with only one adapter and no actual variation;
- scatters one concept across more modules;
- exists primarily to satisfy low-value internal tests.

## Immediate next step

The first concrete task should be an operation inventory and decision table.

It should produce one row per operation with:

- intention;
- current input and output kinds;
- implementation path;
- relation to other operations;
- external or local behavior;
- mutation behavior;
- current callers;
- keep, merge, lower, rename, or remove decision.

No major refactor should begin until this table makes the overlapping operation
model explicit.

The most important question is:

> Given this input and this operation, is there exactly one predictable answer
> for what happens and what kind of result is returned?
