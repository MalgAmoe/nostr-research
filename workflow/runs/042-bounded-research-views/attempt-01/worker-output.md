Implemented task 042.

Deliverables changed:

- Added bounded collection orientation: population, ordering, truncation, freshness, facets, conversation relationships, and corpus/eviction effects.
- Added explicit long-tail facet samples.
- Added bounded, showable comparison views for compatible results.
- Added freshness and corpus effects to subject, retained-set, and facet views.
- Preserved `show` / `inspect` / `explain` separation.
- Updated README documentation.

Validation:

- Task validation passed.
- 26 tests passed; 15 network-dependent tests skipped because loopback listeners are sandbox-restricted.
- Syntax checks and `git diff --check` passed.

Permanent tests expanded:

- Extended the public orientation functional scenario to protect bounded ordering/omission metadata, long-tail visibility, retained-evidence effects, freshness, and comparison populations. Temporary validation would not adequately protect this stable public projection contract.

Unresolved uncertainties: none.