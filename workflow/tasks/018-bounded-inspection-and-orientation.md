---
id: 018-bounded-inspection-and-orientation
status: done
max_attempts: 5
validation: workflow/tasks/018-bounded-inspection-and-orientation.validate.sh
depends_on: 017-explicit-javascript-composition
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded inspection and transparent corpus orientation

## Reason

The console successfully supported an adaptive investigation, including
surviving a disconnected chat, but practical use exposed two recurring costs:
callers guessed different property names across acquisitions, collections,
subjects, and saved sets; and a collection containing only a few very long
notes could flood the terminal. The investigation also rebuilt author and tag
counts manually before it could see corpus domination or choose a direction.

These are inspectability problems. They do not justify automatic ranking,
classification, or a formal preference system.

## Objective

Provide one bounded inspection operation and one transparent facet operation
that help an agent or human understand a corpus before deciding what to do.

## Bounded inspection

Expose:

```js
research.show(value, options)
```

It must recognize at least:

- acquisitions and acquisition coverage;
- result collections;
- events and accounts;
- research sets and runs;
- workspace summaries; and
- session descriptions.

The returned inspection value should use a consistent presentation vocabulary
where meaningful:

```text
type, id, count, preview, context, provenance
```

It is a bounded semantic representation, not a mutation of the underlying
canonical object. Complete original values remain available to JavaScript.

Support small explicit controls such as preview limit, excerpt length, and
whether evidence details are included. Apply safe defaults and hard maximums.
Bound by approximate serialized size and text excerpt length, not only item
count.

Acquisition inspection must expose:

- exact filter and explicit bounds;
- relays contacted and outcome per relay;
- observation and distinct-event counts;
- invalid and duplicate counts where recorded;
- completion reason and operation budgets; and
- coverage uncertainty without claiming exhaustive relay indexing.

## Transparent facets

Expose:

```js
research.facets(collection, options)
```

For the supplied bounded collection, derive deterministic counts for:

- authors;
- tags;
- event kinds;
- observed relays;
- linked source domains; and
- presence of links, images, and videos.

Facets describe the supplied evidence; they are not global trends, quality
scores, or recommendations. Counts must not silently count repeated relay
observations as distinct events. Each facet includes enough identity to become
an explicit later selection.

Bound facet categories and return an explicit omitted count rather than an
unbounded map.

## Presentation consolidation

Clarify and document the responsibilities:

- memory projection provides compact or full semantic research projections;
- `research.show` provides bounded interactive inspection; and
- the REPL writer prevents accidental terminal flooding.

Consolidate duplicated size/excerpt rules where doing so reduces code. Do not
introduce a presentation framework or change canonical persistence shapes
merely to make every object structurally identical.

Inspect whether the in-memory workspace implementation forms a clean cohesive
module. Move it out of the main memory file only if that reduces coupling and
does not require exporting private persistence helpers or creating miniature
index classes. File splitting is not an acceptance criterion.

## Directed field trial

Conduct another real persistent-console investigation using:

- `show` and `facets` for initial orientation;
- `limitPer`, `exclude`, and ordinary JavaScript predicates for positive and
  negative direction;
- explicit follow, mention, and conversation pivots;
- at least two bounded public relays when available; and
- deliberate retention and reopen verification.

Use JavaScript variables for research orientation. Do not implement a lens
class. Record the trial in
`workflow/artifacts/second-console-field-trial.md`, including exact commands,
evidence-backed findings, output or shape friction, and no more than five
justified next tasks.

## Boundaries

- No UI or screenshots.
- No automatic spam, bot, trust, quality, or interestingness classifier.
- No recommendation score or machine-learned preference.
- No custom query language or saved-lens persistence.
- No default relays, background scanning, or unbounded crawling.
- No tests for formatter internals or every facet category.

## Verification

Use one public process-boundary functional scenario that:

- inspects every supported high-level value type without property guessing;
- proves a few very long notes remain bounded;
- calculates facets over events with repeated relay observations;
- uses a facet identity in a later explicit selection;
- applies positive and negative direction as ordinary JavaScript;
- retains and reopens the result; and
- confirms complete canonical evidence remains available outside `show`.

The reviewer must also operate the console interactively against a disposable
database and inspect the field-trial artifact.

## Acceptance criteria

- Common console values have one predictable bounded inspection route.
- Long output is bounded by size as well as item count.
- Facets transparently describe the supplied selection.
- Acquisition outcomes and uncertainty are inspectable.
- Projection, inspection, and REPL responsibilities are not duplicated
  unnecessarily.
- The second trial validates human-scale orientation without formalizing a
  research lens.
- Existing library, CLI, persistence, and console behavior remain usable.
