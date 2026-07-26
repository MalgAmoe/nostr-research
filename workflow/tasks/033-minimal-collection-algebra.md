---
id: 033-minimal-collection-algebra
status: done
max_attempts: 4
validation: workflow/tasks/033-minimal-collection-algebra.validate.sh
depends_on: 032-stable-subject-collections
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md
reviewer_sandbox: workspace-write
---

# Add the minimal typed collection algebra

## Objective

Replace the most repeatedly handwritten neutral JavaScript from the five field
trials with a small JSON-serializable algebra over typed, reason-bearing
collections.

This task covers local transformations only:

- `filter`
- `group`
- `summarize`
- `move`

Existing `retain` remains the explicit lifecycle operation. Bounded relay
acquisition and hydration remain separate existing operations in this task.

## Collection and operation model

- Inputs and outputs have explicit kinds sufficient to distinguish events,
  accounts, relationships, groups, and summaries.
- Invalid input/output combinations fail before partial execution.
- Operations accept plain data descriptions, not caller callbacks or
  executable strings.
- Every stage is inspectable and may be named in context.
- Subject reasons and evidence/provenance references survive transformations
  where they remain applicable.
- Empty results are valid and preserve enough context to explain the attempted
  path.

## Filter

Support positive and negative composition with `all`, `any`, and `not`.
Initially support only fields repeatedly evidenced by the trials:

- subject type and ID;
- event author, kind, text, structured tags, linked domains, and media
  presence;
- account/profile name and description text;
- resident versus nonresident evidence.

Do not encode spam, quality, topic, person/project, or credibility rules.

## Group and summarize

Grouping must cover the repeated stable keys from the trials: subject,
event author, kind, tag, linked domain, and observed relay.

Summaries must use explicit aggregations rather than an open-ended
`summarize` callback. Begin with:

- `count`
- `distinct`
- `sample`
- `collect`
- `min`
- `max`

All results must stay bounded by caller-supplied limits with conservative
defaults.

## Move

Support the repeatedly observed neutral subject transitions:

- events to authors/accounts;
- events to referenced accounts/events when protocol relationships support
  them;
- accounts to authored resident events;
- accounts to followed accounts using current kind-3 semantics.

Do not infer semantic group membership or automatically acquire missing data.

## Boundaries

- Do not build a textual DSL, shell parser, visual graph, or general scripting
  language.
- Do not put acquisition, hydration, eviction, or automatic retention inside
  local transforms.
- Do not add a generic join engine or SQL-like expression language.
- Keep the implementation inside the existing simple library structure.
- Add functional scenarios at the public algebra boundary. Do not create one
  unit test per operation, predicate, aggregation, or helper.

## Acceptance criteria

- Trial-style positive/negative refinement is expressible without JavaScript
  predicates.
- Per-author grouping, counting, representative sampling, and balancing are
  expressible without `Map`, `reduce`, or manual `.items` aggregation.
- Event-to-account movement and current account evidence are composable.
- Operations are JSON-serializable, typed, bounded, reason-preserving, and
  deterministic over the same resident corpus.
- Unsupported combinations fail clearly.
- Existing library and console behavior remains usable.
- Functional tests and syntax checks pass.
