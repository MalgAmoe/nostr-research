Implemented task 071.

Deliverables changed:

- Added shared self-warning detection for direct tags and `L`/`l` self-labels.
- Added `excludeContentWarnings`, default `true`, across engine/session/command precedence.
- Applied exclusion before budgets and ingestion.
- Added operation-wide and per-relay `excludedContentWarnings` accounting.
- Propagated configuration through acquisition, hydration, continuation, fetch, plans, JSONL, and browser Worker paths.
- Updated schema, status, completeness, presentation, context, package docs, capability map, and next steps.
- Kept `memory.ingest()` policy-free.

Validation:

- Syntax checks passed.
- Full functional suite passed: 30/30.
- Diff checks passed.
- Browser smoke could not launch Chromium because the managed macOS sandbox denied Mach rendezvous registration (`Permission denied`); no product assertion ran or failed.
- Live-relay validation was not performed because the task specifies doing it after review passes.

Permanent tests expanded:

- Extended the existing public acquisition scenario to protect default exclusion, explicit override, both warning forms, third-party label/report handling, count separation, absence of memory residue, schema, status, and bounded presentation. A deterministic permanent scenario is justified because this is stable public acquisition policy shared by every consumer.

Unresolved uncertainty:

- Browser smoke requires execution in an environment that permits Playwright Chromium startup.