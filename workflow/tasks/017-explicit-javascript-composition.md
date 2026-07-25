---
id: 017-explicit-javascript-composition
status: done
max_attempts: 5
validation: workflow/tasks/017-explicit-javascript-composition.validate.sh
depends_on: 016-protocol-correct-account-relationships
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Simplify explicit JavaScript composition

## Reason

The console field trial proved that ordinary JavaScript is the right
experimental interaction language. It also exposed avoidable ceremony:
traversal required mutating the current session selection, manually filtered
arrays had to be wrapped in a remembered result-collection envelope, and
common transparent reductions repeatedly reimplemented that envelope.

The solution is a few small functional operations, not a fluent query system
or a formal research-lens abstraction.

## Objective

Make explicit values the primary composable path while retaining session state
as an optional interactive convenience.

## Explicit and session traversal

Support both forms through the prepared console object:

```js
research.traverse(selection, options)
research.traverse(options)
```

The first form must not mutate session selection. The second continues from
the session's current selection and may update it according to the existing
interactive behavior. Ambiguous or invalid argument shapes must fail clearly.

Apply the same principle to `research.follows`: explicit account input is
required, and obtaining follows must not silently replace the current
selection.

## Collection construction

Expose one safe public constructor:

```js
research.collection(items, context)
```

It must validate and normalize through the established shared result
vocabulary. Callers should not need to remember `{ type, items, context }`.
It must not admit fabricated canonical evidence: stored subjects and embedded
records follow the workspace/memory integrity rules established in task 013.

## Minimal transformations

Add only the operations repeatedly needed in real console research:

```js
research.exclude(collection, predicate)
research.distinctBy(collection, selector)
research.limitPer(collection, selector, limit)
research.discoveries(collection)
```

They must:

- accept shared result collections or values already adaptable by the library;
- return ordinary shared result collections;
- preserve subject roles, reasons, provenance, records, and source context;
- preserve deterministic input order;
- validate callback and numeric arguments;
- avoid mutating inputs or session state; and
- add concise transformation context without embedding complete prior results.

`distinctBy` keeps the first item for each selector key.
`limitPer` keeps at most the requested number for each selector key.
`discoveries` selects items whose role is `discovery`.

## Session simplification

Do not move facets, preference learning, ranking, acquisition policy, or
durable query definitions into `ResearchSession`. The session remains focused
on temporary selection, focus, branches, exclusions, and deliberate
checkpoints.

If the implementation reveals console pass-through wrappers that only
duplicate an established public operation, consolidate them within this task.
Do not remove useful direct access to `memory`, `workspace`, or `session`.

## Boundaries

- No fluent collection class or chained query DSL.
- No lens, recommendation, spam, trust, or relevance abstraction.
- No monkey-patching arrays or public mutable internal maps.
- No UI, service API, worker protocol, or storage abstraction.
- Do not add one test per transformation helper.

## Documentation

Show one concise JavaScript sequence that:

- starts with an explicit collection;
- limits dominance per author;
- excludes an unwanted account;
- traverses without mutating the session;
- keeps discoveries; and
- deliberately moves the final result into the session or retention.

## Verification

Use one process-boundary console scenario over realistic stored evidence. In
the same process:

- create and reuse named JavaScript values;
- construct a collection from selected items;
- apply every transformation;
- compare explicit traversal with session traversal;
- prove explicit operations leave session selection unchanged;
- retain a transformed collection and reopen it from SQLite; and
- verify reasons and provenance survived.

Keep permanent verification at this public functional boundary.

## Acceptance criteria

- Explicit composition no longer requires incidental session mutation.
- Manual JavaScript selections can safely re-enter the result vocabulary.
- The four transformations are deterministic and provenance-preserving.
- Sessions remain small and optional.
- Existing library, CLI, and console workflows remain usable.
