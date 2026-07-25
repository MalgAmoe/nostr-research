---
id: 014-playground-field-trial
status: ready
max_attempts: 4
validation: workflow/tasks/014-playground-field-trial.validate.sh
depends_on: 013-minimal-interactive-playground
protected_paths: apps packages CONTEXT.md package.json package-lock.json README.md workflow/ROADMAP.md workflow/WORKFLOW.md workflow/run.py workflow/prompts workflow/tasks
reviewer_sandbox: workspace-write
---

# Conduct a real interactive playground field trial

## Objective

Use the new application for open-ended Nostr research before adding more
features. Begin from bounded relay evidence without selecting a topic in
advance, allow clues to direct the investigation, and evaluate whether the
playground supports different researcher interests through the same actions.

This is an evaluation task. Product and workflow source are read-only.

## Required trial

Use a fresh ignored SQLite database and the running application when network
access permits. If the worker cannot contact public relays, it may copy the
retained `.data/deep-research-trial.sqlite` into a fresh ignored trial database
only after verifying its recorded acquisition runs, exact relays, filters,
bounds, outcomes, event identifiers, and provenance. It must still use the
application for all subsequent research actions and clearly record that the
initial evidence was retained rather than newly acquired.

1. Configure two to four explicit public relays with a considerate bounded
   budget, or verify the exact configuration and outcomes of retained
   acquisition runs when live access is unavailable.
2. Acquire at least three separated time slices or otherwise document a
   sampling approach that reduces newest-event bias.
3. Browse notes and accounts before choosing a research direction.
4. Select at least three candidate clues for different reasons.
5. Focus and acquire bounded surrounding evidence for those subjects.
6. Reject at least one candidate after broader inspection and explain why.
7. Traverse at least two different relationship types.
8. Create a branch, return to an earlier state, and pursue another path.
9. Checkpoint at least one useful account group or evidence corpus.
10. Close the application, reopen the checkpoint, and continue.

Use the application for research actions. Direct SQLite inspection may be used
only to diagnose or verify behavior and must be identified as missing
playground capability.

## Required deliverable

Create `workflow/artifacts/first-playground-field-trial.md` containing:

- the acquisition plan, relays, filters, slices, and budgets;
- relay outcomes and explicit sampling limitations;
- the path from broad observation to chosen clues;
- candidate accounts or subjects and the evidence for keeping or rejecting
  them;
- branches, backtracking, traversal, checkpoint, and reopen behavior;
- what was possible through the application alone;
- every point where CLI, raw SQLite, or source inspection was needed;
- usability and performance failures separated from protocol/data limitations;
- whether the shared actions support genuinely different research directions;
- no more than five evidence-backed next improvements; and
- explicit features or rules that should not be encoded yet.

Do not paste raw event dumps or make broad claims about Nostr from the sample.

## Review expectations

The independent reviewer must inspect the retained database and report, start
the application, reproduce at least one saved-path continuation, and verify
that recommendations arise from observed use.

If public relay access is unavailable but a traceable real-evidence database
exists, the reviewer may reproduce local continuation against that evidence.
Fixtures are not a substitute for real research evidence.

## Acceptance criteria

- The complete trial uses real relay evidence through the application,
  distinguishing newly acquired from verified retained evidence.
- The report distinguishes sampling, relay, protocol, software, and UX issues.
- At least two research directions use the same playground actions.
- Checkpoint and reopen work.
- Product source remains unchanged.
- Recommendations are few, concrete, and supported by the trial.
