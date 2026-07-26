---
id: 043-judgment-and-session-ergonomics
status: done
max_attempts: 4
validation: workflow/tasks/043-judgment-and-session-ergonomics.validate.sh
depends_on: 042-bounded-research-views
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add explicit judgment and complete the research session lifecycle

## Objective

Let a researcher carry provisional judgment through a session and manage the
resulting workspace without hidden rules or arbitrary JavaScript.

## Work

- Support explicit subject or result annotations such as interested,
  uninterested, uncertain, and anchor.
- Allow optional strength and a caller-authored reason.
- Make annotations usable as ordinary positive or negative pipeline
  constraints while keeping them visibly provisional and process-local.
- Preserve positive and negative examples as evidence; do not train or infer
  automatic classifications.
- Complete handle and retained-set lifecycle:
  - warn before retaining an empty result;
  - list, inspect, rename, replace, delete, and bulk-release;
  - distinguish releasing a handle from deleting a retained set;
  - prevent accidental silent replacement unless explicitly requested.
- Add concise session/schema discovery, clear input-type errors, and literal
  account field documentation.
- Provide a small set of declarative templates only where they expand to the
  same normalized operations and remain inspectable.

Remove or simplify obsolete session surface revealed by this work. Do not
retain compatibility code for unused experimental behavior.

## Milestone field trial

Repeat several earlier open-ended research tasks through the JSONL session,
including:

- finding a coherent group of accounts from a noisy acquisition;
- pursuing one account into authored notes and conversation context;
- expressing both positive and negative interest;
- changing direction and releasing intermediate state.

Use no dynamically authored JavaScript for research operations. Record exact
friction and any still-missing neutral operation in:

`workflow/artifacts/composable-session-field-trial.md`

The trial must judge whether the declarative session now provides the
practical exploratory capability previously supplied by JavaScript. It must
not claim success merely because commands execute.

## Acceptance criteria

- Judgments are explicit, explainable, process-local, and composable.
- Handle and retained-set lifecycle is complete and unambiguous.
- Operation/field discovery is sufficient to use the session without source
  inspection.
- The milestone trial performs genuine iterative navigation without dynamic
  JavaScript.
- The artifact identifies what belongs in the library, what remains human
  judgment, and whether the JavaScript REPL can now be deprecated.
- Obsolete or redundant session code encountered by the task is removed.

## Verification

- Permanent tests expected: yes, one public session-lifecycle functional
  scenario may protect annotation and retained-set semantics.
- Stable public behavior protected: explicit judgments, lifecycle distinction,
  normalized template expansion, response envelopes.
- Temporary task validation or field evidence: the milestone field trial and
  bounded live transcript.
- Explicitly excluded test levels or mechanisms: one test per command,
  inferred-quality tests, network transport tests, UI tests, compatibility
  tests for unused experiments.
