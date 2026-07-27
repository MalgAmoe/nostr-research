---
id: 056-sustained-research-trial-and-cleanup
status: done
max_attempts: 4
validation: workflow/tasks/056-sustained-research-trial-and-cleanup.validate.sh
depends_on: 055-predictable-inspection-and-session-use
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Validate sustained research and remove superseded code

## Objective

Use the simplified system long enough to judge whether it supports real,
sequential research. Remove accidental complexity exposed by the trials and
leave the package, tests, and active documentation coherent.

## Work

- Run two sustained sessions through the real persistent executable:
  1. a goal-directed search for credible profiles in a chosen field;
  2. open-ended exploration from a bounded recent-event sample.
- In both sessions repeatedly acquire, inspect, filter, navigate, relate,
  preserve, discard, and redirect the investigation.
- Record:
  - what evidence was available;
  - what each result contained;
  - provenance and membership explanations;
  - local versus external operations;
  - bounds, partiality, unresolved evidence, and omissions;
  - how next operations were discovered;
  - transitions among events, accounts, conversations, neighborhoods,
    collections, and relations;
  - preservation and buffer-turnover behavior;
  - any remaining need for arbitrary JavaScript and the exact missing
    primitive or composition.
- Write the evidence and verdict to:

  `workflow/artifacts/simplified-system-field-trial.md`

- After the trial, remove superseded code, exports, commands, tests, task-era
  terminology, and active documentation.
- Update `CONTEXT.md`, the package README, and `workflow/ROADMAP.md` to describe
  only the final system.
- Do not add speculative operations solely in response to one research topic.

## Acceptance criteria

- Both sessions demonstrate sustained, sequential research rather than a
  scripted happy path.
- The artifact distinguishes system capability from researcher judgment and
  Nostr data quality.
- Ordinary navigation and analysis do not require arbitrary JavaScript.
- Any genuinely missing capability is stated narrowly with field evidence.
- The final implementation has no known duplicate operation or session model.
- Permanent tests protect only stable public behavior and protocol rules.
- Active documentation agrees on terminology, ownership, and operation flow.
- Full validation passes.

## Verification

- Permanent tests expected: no new tests unless a stable public regression is
  discovered and not already covered.
- Stable public behavior protected: the integrated memory, operation,
  inspection, session, and JSONL research flow.
- Temporary task validation or field evidence: two sustained sessions recorded
  in the required artifact; bounded live relays may be used when available.
- Explicitly excluded test levels or mechanisms: permanent live-relay tests,
  WebSocket/TCP tests, UI, screenshots, persistence, tests per command, and
  implementation snapshots.
