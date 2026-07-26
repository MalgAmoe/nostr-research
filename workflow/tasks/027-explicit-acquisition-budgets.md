---
id: 027-explicit-acquisition-budgets
status: ready
max_attempts: 5
validation: workflow/tasks/027-explicit-acquisition-budgets.validate.sh
depends_on: 026-remove-sqlite
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make acquisition budgets explicit and semantically correct

## Objective

Correct the mismatch between relay observations and distinct Nostr events.
Acquisition and expansion must expose separate, plainly named bounds so callers
can control relay work without mistaking duplicate observations for new events.

## Required behavior

- Replace the misleading public `eventLimit` option with explicit observation
  and distinct-event budgets. There is no compatibility requirement for the old
  name.
- The observation budget is a hard operation-wide bound on accepted valid
  `EVENT` messages across all relays.
- The distinct-event budget is a hard operation-wide bound on unique canonical
  event IDs acquired by the operation.
- Completion and reports identify which bound stopped the operation.
- Counts and budget reports consistently distinguish received packets, accepted
  observations, duplicate observations, newly stored corpus events, and
  distinct events acquired by the operation.
- Authored-note limits count distinct authored event IDs per starting account,
  not observations returned by multiple relays.
- Expansion and reply-context resolution propagate the new budget vocabulary
  and never silently reinterpret one kind of limit as another.
- Console progress and presentation use the same terminology.

The implementation must remain bounded under duplicate-heavy relay responses.
It is acceptable for an observation bound to stop an operation before its
distinct-event target is reached; that uncertainty must be visible rather than
hidden.

## Boundaries

- Do not add adaptive relay heuristics, retries, persistence, or quality rules.
- Do not encode assumptions about which relay is authoritative.
- Do not redesign the corpus, sessions, retained selections, or presentation
  architecture in this task.
- Avoid unit tests for option plumbing. Exercise the public acquisition and
  expansion boundaries with duplicate relay observations.

## Documentation

Update active README and canonical context where they describe acquisition
budgets. Historical task definitions and field-trial artifacts remain
historical records.

## Acceptance criteria

- No active public option or active documentation calls an observation bound
  `eventLimit`.
- Direct acquisition enforces and reports both bounds.
- Duplicate observations do not consume the distinct-event budget.
- Authored-note expansion limits distinct notes per account.
- Acquisition, expansion, and reply-context reports use coherent counts.
- Existing cancellation, timeout, relay outcome, provenance, and corpus
  capacity behavior remains intact.
- Functional tests and syntax checks pass.
