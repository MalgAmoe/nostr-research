Implemented bounded research views and corrected the field-trial defects.

Deliverables changed:

- Added bounded orientation, facets with long-tail visibility, comparison views, freshness, corpus pressure, retention, and eviction metadata.
- Account views now distinguish absent profile evidence from existing membership reasons and provenance.
- Conversation views fall back to member relationship reasons when collection-level edges are absent.
- Updated public documentation and field-evidence report.

Validation:

- `workflow/tasks/042-bounded-research-views.validate.sh` passed.
- 26 tests passed; 15 network tests skipped because loopback listeners are sandbox-restricted.
- `git diff --check` passed.

Permanent tests expanded:

- Extended the public orientation functional scenario to protect bounded projection metadata, compatible comparisons, account membership evidence without profiles, and reason-only conversation relationships.
- This protects stable public `show` behavior that temporary live validation alone would not reliably preserve.

Unresolved uncertainties: none. No files were staged or committed.