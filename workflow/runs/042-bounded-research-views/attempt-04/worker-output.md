Implemented the bounded research views, including the review fix.

Deliverables changed:

- Added bounded orientation, facets, freshness, corpus effects, conversation evidence, and comparison projections.
- Declarative comparison `show` now reports ordering, truncation/operation bounds, corpus pressure, capacity, and evictions.
- Summary-only comparisons explicitly disclose that subject-level residency is unavailable instead of creating a parallel evidence collection.
- Updated documentation and field evidence.

Validation:

- `workflow/tasks/042-bounded-research-views.validate.sh` passed.
- 26 tests passed; 15 network-mechanics tests skipped because loopback listeners are sandbox-restricted.
- `git diff --check` passed.

Permanent functional tests expanded:

- Public orientation scenario protects bounded projection, long-tail, membership, conversation, and corpus metadata.
- Public declarative-session scenario protects comparison bounds and corpus-effect metadata. Temporary validation was insufficient because this is a stable public projection contract.

Unresolved uncertainties: none beyond sandbox-skipped loopback scenarios.