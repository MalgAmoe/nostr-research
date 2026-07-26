# Workflow status

Task definitions under `workflow/tasks/` are the authoritative record of
completed and ready work. Worker and reviewer runs remain committed as the
durable execution and review history for those tasks.

The completed foundation provides:

- canonical Nostr evidence in one bounded process-local corpus;
- bounded live relay acquisition with explicit coverage;
- composable search, selection, traversal, expansion, and retention;
- transparent connection aggregation, profile hydration, and process-local
  annotations;
- a process-lifetime JavaScript console for agent-operated research;
- protocol-correct account relationships and replaceable events;
- bounded inspection, authored-note expansion, and reply contexts.

Persistence and a database format are deliberately absent. Closing or
resetting the corpus, or ending its Node process, loses events, observations,
and retained selections. Acquisition coverage is returned directly and is not
registered as history. Removing the remaining Node dependencies belongs to a
separate future milestone.

New tasks should be derived from console-driven research. The project should
not pre-encode universal discovery or quality rules without field evidence.

The acquisition and interface cleanup completed in tasks 027-031:

- make observation and distinct-event acquisition budgets explicit;
- remove inactive run, coverage-history, set-algebra, and alias surfaces; and
- make console selection changes explicit and simplify session and
  presentation around the reduced research model;
- enforce relay filters, correct composed distinct-event budgets, reject
  unknown acquisition options, and restore retained-selection activation; and
- remove fixture loading and ignored inspection options from the production
  interface.

Subsequent direct field work added local account-description search,
connection aggregation, bounded profile hydration, and caller-defined
annotations. JavaScript remains the experimental composition surface while the
project gathers evidence for a smaller declarative operation vocabulary.

The five declarative-operation field trials now justify the next milestone:

1. make collections stable subject/reason references which resolve current
   canonical evidence;
2. add a minimal typed local algebra for filtering, grouping, summarizing, and
   moving between subjects; and
3. compose that algebra with explicit bounded acquisition, hydration, and
   retention as named plain-data stages, then validate it through live use.

This milestone does not commit the project to a textual DSL, plan graph, Rust
executor, UI, persistence model, or automated account classification.

The first post-milestone root review identified one narrow correctness pass
before further field work: fully preflight plans before external effects,
constrain select dependencies to acquisition ordering, refresh stable subjects
inside reusable typed groups, reject duplicate aggregation names, and make
bounded group counts and omissions explicit.

After that correctness pass, live plan use showed that the algebra can express
the research operations but cannot yet replace the persistent JavaScript REPL
as an interaction environment. The next milestone is therefore:

1. a persistent declarative session with engine-owned named handles, stable
   response envelopes, mutation-only revisions, and shared plan execution;
2. bounded `show`, `inspect`, and membership `explain` projections plus handle
   lifecycle; and
3. a protocol-clean JSONL adapter validated through live investigations with
   no dynamically authored JavaScript.

This milestone adds an interactive execution environment around the existing
algebra. It does not expand the algebra or commit to a browser, Rust,
persistence, UI, DSL, or concurrency architecture.

The JSONL field trial subsequently showed that the persistent session is a
sound adapter and lifecycle boundary, but its fixed operation vocabulary does
not yet replace the exploratory usefulness of the JavaScript console. The
next queued milestone therefore adds, in order:

1. acquisition-scoped working buffers with concise bounded orientation;
2. one coherent typed pipeline for neutral collection composition;
3. selection-driven bounded continuation through Nostr relationships;
4. bounded research views which expose evidence without interpreting it; and
5. explicit provisional judgment plus a complete session lifecycle, followed
   by a no-JavaScript field trial.

The architecture remains:

```text
canonical corpus
  -> scoped working buffers
  -> composable collection operations
  -> evidence views
  -> explicit researcher judgment
  -> bounded continuation
```

These tasks do not add persistence, UI, automated identity classification,
universal discovery rules, arbitrary code execution, or a new memory model.
