---
id: 045-remove-superseded-research-interfaces
status: done
max_attempts: 4
validation: workflow/tasks/045-remove-superseded-research-interfaces.validate.sh
depends_on: 044-heterogeneous-continuation-presentation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Remove superseded JavaScript console and session interfaces

## Objective

Make the persistent declarative session the sole product research interface.
Delete the older JavaScript REPL and active-selection session lineage now that
the JSONL field trial has shown it is no longer required.

This project has no legacy-compatibility requirement.

## Work

- Delete the JavaScript research console executable and implementation.
- Delete the old active-selection `ResearchSession` implementation.
- Remove their package scripts, binary declarations, exports, documentation,
  help text, and tests.
- Rewrite surviving functional scenarios to cross the memory, declarative
  session, or JSONL interfaces only when they still protect useful behavior.
- Delete test cases whose only purpose is preserving the removed interfaces;
  do not mechanically reproduce them through JSONL.
- Remove direct helper methods, presentation entry points, or dependencies
  that become unreachable after this deletion.
- Update `CONTEXT.md` and the package README so `session` unambiguously means
  the persistent declarative research session.

Do not change Nostr acquisition semantics, collection algebra, continuation
relationships, persistence policy, or introduce a replacement console.

## Acceptance criteria

- No JavaScript REPL executable or `createResearchEnvironment` interface
  remains.
- No active-selection `ResearchSession`, activate, checkpoint, or implicit
  current-selection semantics remain.
- The declarative session and JSONL executable retain their current behavior.
- Documentation describes one research-session model.
- Deleted-interface tests are removed rather than translated one-for-one.
- Full validation passes with a materially smaller public and test surface.

## Verification

- Permanent tests expected: no new tests.
- Stable public behavior protected: existing declarative-session, JSONL,
  memory, acquisition, and protocol functional scenarios.
- Temporary task validation or field evidence: package export/bin inspection
  and one JSONL local-memory smoke workflow.
- Explicitly excluded test levels or mechanisms: compatibility tests for the
  removed interfaces, UI, relay-network, socket, and private helper tests.
