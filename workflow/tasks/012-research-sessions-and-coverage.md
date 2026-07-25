---
id: 012-research-sessions-and-coverage
status: ready
max_attempts: 5
validation: workflow/tasks/012-research-sessions-and-coverage.validate.sh
depends_on: 011-reliable-memory-and-results
protected_paths: docs/solid-experiment-lessons.md workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add temporary research sessions and acquisition coverage

## Objective

Define the smallest UI-independent research playground coordinator over the
reliable memory and shared result vocabulary.

A session represents temporary exploration: current selection, focus, useful
branches, exclusions, and meaningful actions. It is not canonical evidence,
not browser UI state, and not automatically durable.

At the same time, make bounded acquisition coverage explicit enough that a
session can decide what evidence is locally present and what bounded relay work
was already attempted.

## Session semantics

Provide a public session module that can:

- start from an empty selection, result collection, run, or research set;
- expose the current selection and optional focused subject;
- replace the current selection with a new result;
- include or exclude subjects provisionally;
- branch from the current selection under a temporary session-local name;
- return to an earlier meaningful state;
- apply selection or traversal through the existing memory operations;
- checkpoint a chosen state into a durable research set; and
- explain the meaningful action that produced the current state.

Session actions should use a small explicit vocabulary such as observe, focus,
select, include, exclude, traverse, compare, acquire, retain, branch, and back.
Names may be sharpened by implementation, but do not record incidental UI
actions, scrolling, open panels, or every inspection.

Temporary branches and history may remain in process for this milestone.
Do not invent permanent session serialization or compatibility formats.

## Views

A view reads a session selection and returns a projection or derived grouping;
it does not own or mutate the selection.

Support at least subject-list and account-list views through the existing
projection machinery. Leave thread as a composed view. Do not implement
ranking, dashboards, or graph visualization.

## Acquisition coverage

Persist enough acquisition context to answer:

- which explicit relays were contacted;
- the exact NIP-01 filter, including supplied bounds;
- operation budget and completion reason;
- each relay outcome;
- observed event IDs and observation times; and
- whether a requested relay/time/filter slice was previously attempted.

Coverage describes attempts and observations, not a claim that a relay or time
window was exhaustively indexed.

Extend acquisition so its result can enter the same reusable result vocabulary
and become a session selection without CLI translation.

## Polite bounded planning

Add only evidence-backed planning primitives needed now:

- explicit relay concurrency, timeout, and event budgets;
- deterministic time slicing of a caller-supplied time range and target;
- optional NIP-11 relay information retrieval with a bounded timeout;
- respect for advertised maximum query limit when available; and
- parsing of NIP-65 kind-10002 read/write relay lists as stored evidence.

The caller remains in control. Do not add default public relays, retry storms,
automatic relay scoring, hidden fallback policy, or network-wide crawling.

## Documentation

Document the distinction between:

- memory, session, selection, focus, temporary branch, research set, run, and
  acquisition coverage;
- local selection and relay acquisition; and
- advertised relay capability versus observed relay behavior.

Update `CONTEXT.md` with the settled playground terms introduced here.

## Scope boundaries

- Do not build application UI.
- Do not serialize complete sessions.
- Do not introduce opaque interestingness, spam, trust, or relay scores.
- Do not add general job orchestration, command buses, or event sourcing.
- Do not assume NIP-11 claims are accurate; retain them as advertised
  information.

## Verification

Use a small number of public functional scenarios:

- begin with a selection, focus, include/exclude, traverse, branch, back, and
  checkpoint; verify temporary changes do not mutate evidence or saved sets;
- close/reopen memory and continue from the checkpoint;
- record two bounded acquisition slices and distinguish covered attempts from
  unattempted windows; and
- validate NIP-11 limit handling and NIP-65 parsing with stable protocol-level
  examples.

The reviewer must drive the session through the public library rather than
testing private state.

## Acceptance criteria

- A UI, CLI, or agent can drive the same session actions.
- Current selection and focus are temporary and independently replaceable.
- Branch/back behavior preserves earlier selections without copying evidence.
- Exclusions are session-local unless deliberately checkpointed as reasons.
- Checkpoints use atomic durable retention.
- Acquisition returns a reusable result collection.
- Coverage is durable, bounded, and explicit about uncertainty.
- Planning primitives remain caller-controlled and relay-considerate.

