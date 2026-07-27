Implemented task 049’s research notebook consolidation.

Deliverables changed:

- Replaced annotations and retained sets with memory-owned notebook entries and named memberships.
- Added provisional judgments, attribution, reasons, source references, labels, notes, strength, and bounded summaries.
- Added declarative notebook querying, remembering, forgetting, membership inspection/replacement/deletion, and later-operation reuse.
- Kept notebook and evidence archive lifecycles independent.
- Removed superseded commands, APIs, subject shapes, schema, presentation, and documentation.
- Updated public documentation.

Validation:

- Task validation script passed.
- All 21 tests passed.
- Syntax checks and `git diff --check` passed.

Permanent test expanded:

- Extended the public declarative-session workflow to protect positive/negative judgments, explainable named membership, buffer-turnover survival, archive independence, and notebook/membership reuse as later operation inputs.
- This stable lifecycle behavior warranted permanent coverage because temporary validation would not protect the cross-store independence contract.

Unresolved uncertainties: none.