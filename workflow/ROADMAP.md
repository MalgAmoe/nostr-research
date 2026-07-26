# Workflow status

Task definitions under `workflow/tasks/` are the authoritative record of
completed and ready work. Worker and reviewer runs remain committed as the
durable execution and review history for those tasks.

The completed foundation provides:

- canonical Nostr evidence in one bounded process-local corpus;
- bounded live relay acquisition with explicit coverage;
- composable search, selection, traversal, expansion, and retention;
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

The acquisition and interface cleanup completed in tasks 027-029:

- make observation and distinct-event acquisition budgets explicit;
- remove inactive run, coverage-history, set-algebra, and alias surfaces; and
- make console selection changes explicit and simplify session/presentation
  around the reduced research model.

The post-refactor review queued two follow-up tasks:

- enforce relay filters, correct composed distinct-event budgets, reject
  unknown acquisition options, and restore retained-selection activation; and
- remove fixture loading and ignored inspection options from the production
  interface.
