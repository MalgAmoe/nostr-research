# Workflow status

Task definitions under `workflow/tasks/` are the authoritative record of
completed and ready work. Worker and reviewer runs remain committed as the
durable execution and review history for those tasks.

The completed foundation provides:

- canonical Nostr evidence in durable SQLite memory;
- bounded live relay acquisition with explicit coverage;
- composable search, selection, traversal, expansion, and retention;
- a persistent JavaScript console for agent-operated research;
- protocol-correct account relationships and replaceable events;
- bounded inspection, authored-note expansion, and reply contexts.

New tasks should be derived from console-driven research. The project should
not pre-encode universal discovery or quality rules without field evidence.
