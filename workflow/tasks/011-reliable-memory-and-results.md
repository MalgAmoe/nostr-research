---
id: 011-reliable-memory-and-results
status: done
max_attempts: 5
validation: workflow/tasks/011-reliable-memory-and-results.validate.sh
depends_on: 010-composable-research-kernel
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make research memory reliable at realistic corpus size

## Objective

Repair the concrete reliability and performance failures found during live
research before adding new research concepts.

The behavior of selection, traversal, projection, runs, and research sets
should remain recognizable. This task deepens their implementations so a
researcher can safely operate on hundreds or thousands of events.

## Atomic bulk retention

All operations that create a populated research set must be atomic:

- retaining a result collection;
- creating a set from a run;
- expanding a set; and
- combining sets.

If validation, interruption, or insertion fails, the new set and all of its
members and reasons must be absent. A caller must never observe a partially
created set.

Use one transaction for the complete bulk write. Do not call the public
single-member operation in a loop. Prepare statements once where practical,
deduplicate members and reasons before writing, and return a bounded
acknowledgement without reloading every reason merely to count members.

The public single-member editing behavior may remain for interactive changes.

## Concentrated SQLite evidence access

Stop repeatedly loading the complete event corpus and issuing one observation
query per event.

Concentrate SQLite evidence access inside a small internal module or cohesive
section that supports the actual current operations:

- indexed event selection and prefix resolution;
- current account metadata lookup;
- event hydration with observations;
- relationship lookup or reproducible relationship scanning;
- subject summary hydration; and
- counts and bounded previews for sets and runs.

Add only indexes justified by those operations. SQLite remains the sole real
storage path. Do not introduce a generic backend interface, ORM, repository
framework, or migration compatibility layer.

## Shared result behavior

Reduce unnecessary parallel behavior without forcing a broad redesign:

- selection and traversal continue to return reusable result collections;
- acquisition, account results, and convenience navigation should be
  adaptable into the same collection vocabulary without parsing rendered
  output;
- seed subjects and newly discovered subjects must remain distinguishable;
- compact projection must not repeat complete source and target summaries on
  every relationship;
- full projection retains canonical evidence and complete explanations;
- retention acknowledgements remain bounded independently of corpus size.

Do not remove useful compatibility operations solely to make the method list
shorter. Delete pass-through shaping only where the shared operation fully
replaces it and callers/tests can move to the deeper interface.

## Provenance size

Preserve explainability while avoiding repeated embedding of identical
observation arrays inside every traversal reason and set reason.

Stable references to stored evidence, observations, runs, or acquisition
context are preferable when the explanation can be reconstructed. Do not
discard relay, time, filter, relationship interpretation, or membership
reasons.

## Documentation

Update the package documentation to describe:

- atomic retention behavior;
- result-collection seed versus discovery semantics;
- the cost and bounds of compact versus full projection; and
- SQLite as the current implementation rather than a permanent public data
  model.

## Scope boundaries

- Do not add research sessions, new application code, ranking, discovery
  heuristics, aggregations, or relay-planning policy.
- Do not preserve old experimental database compatibility.
- Do not split files merely to reduce line counts.
- Do not add tests for private helpers or every projection variation.

## Verification

Permanent verification should contain:

- one functional scenario retaining at least 1,000 result members and multiple
  reasons within a reasonable local runtime;
- one deliberate failure scenario proving rollback leaves no partial set;
- one representative selection/traversal/projection flow over a corpus large
  enough to expose full-corpus/N+1 regressions; and
- existing protocol-focused and public functional scenarios.

The reviewer must use the public library with a disposable SQLite database,
retain a realistically large selection, close/reopen it, and verify complete
membership. It must also inspect compact thread output for bounded repetition.

## Acceptance criteria

- No populated-set operation can leave a partial new set.
- Retaining 1,000 ordinary event members completes without per-member
  full-set reloads.
- Common bounded selection and projection do not hydrate every observation for
  the entire corpus.
- Compact relationship and thread output are materially bounded.
- Full evidence and provenance remain explainable.
- Shared result collections remain directly composable.
- Existing public research behavior and CLI commands remain usable.
- Permanent tests stay boundary-focused.
