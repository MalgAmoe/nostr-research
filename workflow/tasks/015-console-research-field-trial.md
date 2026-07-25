---
id: 015-console-research-field-trial
status: done
max_attempts: 4
validation: workflow/tasks/015-console-research-field-trial.validate.sh
depends_on: 014-persistent-javascript-research-console
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Conduct a persistent-console research field trial

## Objective

Operate the JavaScript research console as an agent would during a real,
guided Nostr investigation. Validate the interaction model against actual
research work rather than treating process startup as sufficient.

This task may make small cohesive repairs to the console or public composition
surface when the field trial exposes a concrete blocker. It must not add
speculative discovery rules.

## Investigation

Use explicit, bounded public relay acquisition to find a small set of
potentially interesting accounts and connected discussions. Begin with broad
evidence, inspect what the data contains, then direct subsequent acquisition
or traversal from observed accounts, tags, replies, mentions, or follow
evidence.

The goal is not to assert a universal definition of "interesting." The goal is
to exercise the reusable path:

```text
acquire -> inspect -> select -> expand -> compare -> retain
```

Use at least two relays when available. Keep time ranges, concurrency,
timeouts, and event budgets explicit and polite. Record relay failures as
evidence; do not compensate with unbounded retries.

## Deliverable

Create `workflow/artifacts/first-console-field-trial.md` containing:

- exact runtime setup and bounded acquisition parameters;
- representative JavaScript commands submitted to the same console process;
- concise findings with event/account identifiers and provenance;
- which operations composed naturally;
- concrete friction or missing operations;
- any small repairs made and why they were necessary; and
- no more than five evidence-backed candidate next tasks.

Do not commit the disposable SQLite database.

## Permitted repairs

Repairs must be directly justified by a failed or awkward field-trial step and
remain within the library or console:

- fixing incorrect composition or result handling;
- making an existing result inspectable without flooding output;
- exposing a missing direct route to an already-supported library operation;
- correcting lifecycle, cancellation, or persistence behavior; or
- sharpening misleading documentation.

Do not add ranking, trust, spam, recommendation, clustering, background scans,
UI code, or general plugin systems.

## Verification

The permanent suite stays boundary-focused. Add a regression only when the
trial exposed an actual correctness defect not already covered by a public
scenario. Do not encode field-trial data or subjective account choices as
tests.

The reviewer must run the console through a persistent process, not translate
the commands into separate CLI invocations.

## Acceptance criteria

- One console process supports a multi-step adaptive investigation.
- Live acquisition is bounded, explicit, and provenance-preserving.
- Intermediate JavaScript values are reused in later operations.
- At least one meaningful result is retained and readable after reopening.
- The artifact distinguishes observed evidence from interpretation.
- Any code repair is small and directly tied to trial evidence.
- Recommendations arise from actual use rather than speculative architecture.
