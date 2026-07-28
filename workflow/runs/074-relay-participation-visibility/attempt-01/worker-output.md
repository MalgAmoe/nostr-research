Implemented task 074.

Deliverables changed:

- Added per-relay lifecycle facts: `attemptStarted`, `socketOpened`, and `subscriptionSent`.
- Propagated facts through acquisition, hydration, continuation reuse, session coverage/details, plans, JSONL/browser shared engine reports, schemas, and external completeness summaries.
- Updated `CONTEXT.md` and package README.
- Extended the public acquisition fixture for unstarted, pre-open, subscribed-zero, rejected-packet, contributed, peer-close, EOSE, hydration, and global-budget outcomes.

Validation performed:

- `npm run check`
- `npm test`
- Task validation script
- `git diff --check`

All 34 tests pass.

Permanent tests expanded: `acquisition.functional.test.js`, protecting truthful public lifecycle reporting and global-budget cancellation behavior. Temporary validation alone was insufficient because these are stable public coverage semantics.

Unresolved uncertainties: none.