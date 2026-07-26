---
id: 034-named-research-plans-field-trial
status: done
max_attempts: 4
validation: workflow/tasks/034-named-research-plans-field-trial.validate.sh
depends_on: 033-minimal-collection-algebra
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md
reviewer_sandbox: workspace-write
---

# Compose and field-test named research plans

## Objective

Integrate the collection algebra with the existing bounded acquisition,
hydration, and retention lifecycle as a small named-stage research plan, then
test it on live Nostr research.

The goal is not to build the final language. It is to prove that one plain-data
representation can drive the recurring research loop while leaving judgment
with the caller.

## Plan model

A plan is a JSON-serializable list of named stages. A stage:

- has a stable stage ID;
- declares one operation and its plain-data parameters;
- refers explicitly to prior stage inputs;
- produces an inspectable typed result or bounded external-operation report;
- preserves reasons, evidence references, provenance, and resident status.

Linear execution is sufficient. Do not add branching syntax, a graph runtime,
incremental recomputation, or plan persistence. Named prior stages may be
reused only where this falls naturally out of the simple representation.

## External and lifecycle stages

Integrate existing operations rather than duplicating them:

- bounded `acquire`;
- bounded `hydrate`;
- explicit `retain`.

External stages expose relays, timeouts, observation/distinct-event limits, and
their completion reports. No acquisition or retention is implicit.

User judgments such as chosen tags, excluded domains, selected examples,
labels, names, and reasons are supplied plan data. The engine must not invent
them.

## Field trial

Run a fresh live trial from a mostly random bounded buffer:

1. orient;
2. choose a direction from observed evidence;
3. filter positively and negatively;
4. group or summarize;
5. move to accounts or related subjects;
6. hydrate where explicitly requested;
7. retain at least five subjects with supplied reasons.

Record:

- the complete plan data actually executed;
- acquisition/corpus budgets and eviction;
- stage result kinds and concise counts;
- user/agent judgments supplied as parameters;
- any JavaScript still required outside the plan;
- failed or awkward operations;
- whether the abstraction should be kept, reduced, or adjusted.

Write the report to
`workflow/artifacts/declarative-research-plan-field-trial.md`.

## Cleanup

Make only small corrections directly supported by the field trial. Remove
unused or redundant algebra/plan surface rather than preserving speculative
features. Update active documentation with the proven interface.

## Boundaries

- No UI, textual DSL, Rust port, persistence, database, plugin system, or
  automatic classifier.
- Do not modify the earlier five-trial artifact; it is protected evidence.
- Do not add operations merely because they might be useful later.
- Use functional validation at the public plan boundary, plus the live trial.
  Do not duplicate every algebra test at the plan layer.

## Acceptance criteria

- One plain-data named plan performs the complete bounded research loop.
- The report contains the exact plan and remaining JavaScript.
- No domain judgment is hidden in the engine.
- Acquisition and hydration remain explicit and bounded.
- Reasons, provenance, and resident status remain inspectable.
- The final public surface contains only operations justified by the trials.
- Functional tests, syntax checks, and the documented validation scenario
  pass.
