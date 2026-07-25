---
id: 007-saved-research
status: done
max_attempts: 5
validation: workflow/tasks/007-saved-research.validate.sh
depends_on: 006-query-and-navigate-memory
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Preserve and continue research paths

## Objective

Let callers preserve how evidence was selected, reopen it later, and continue
research without relying on UI session state or conversation memory.

Build this on the existing acquisition, local-query, navigation, and SQLite
boundaries. Keep the model small enough to evolve.

## Research runs

Persist an immutable record for a completed acquisition or local-query
operation containing:

- a stable run identifier;
- operation type and normalized public inputs;
- start and finish times;
- completion status and diagnostics;
- result event and account identifiers;
- enough provenance and match-reason information to explain the recorded
  result without reproducing hidden UI state.

A run records what happened. Re-running the same inputs creates another run
rather than rewriting history.

Do not store sockets, callbacks, transient implementation state, or SQL details.

## Research sets

Support durable named sets that can contain event and account identifiers:

- create, list, inspect, rename, and delete a set;
- add and remove members explicitly;
- retain one or more membership reasons and the source run or source entity
  when applicable;
- create a set from a recorded run;
- reopen the database and continue using the same set;
- tolerate referenced evidence that is not yet present locally.

Names are user-facing labels, not identity. Set identifiers must remain stable
when renamed.

## Continuation and set operations

Through the public library boundary:

- expand a set using selected observable relationship types already supported
  by local navigation;
- preserve the source member and relationship evidence for expanded members;
- combine sets using union, intersection, and difference without mutating the
  input sets;
- distinguish event and account members;
- explain why every member is in a resulting or expanded set.

No operation should silently contact a relay. A future caller can explicitly
run acquisition and then record or add its results.

## CLI behavior

Add discoverable structured commands that can:

- record or save the result of an acquisition or local query as a run;
- list and inspect runs;
- create and manage named sets;
- create a set from a run;
- expand a set;
- combine sets;
- explain one set member.

The exact command grouping may remain compact, but it must be practical for a
human or Codex CLI workflow and must not require direct SQLite access.

## Scope boundaries

- Do not add UI state, tabs, layouts, browsing history, ranking, suggestions,
  moderation policy, synchronization, accounts-to-follow semantics, or remote
  storage.
- Do not preserve compatibility with disposable databases created before this
  task.
- Do not introduce a general workflow engine or abstract graph framework.
- Do not force all future research methodology into one fixed schema.

## Verification

Use the public library and CLI with a temporary real SQLite database to perform
one complete black-box path:

1. ingest or acquire signed evidence;
2. perform a local query and record its run;
3. create a set from that run;
4. expand it through an observable relationship;
5. combine it with another set;
6. close and reopen the database;
7. inspect the saved set and explain membership.

The functional scenario should verify behavior, not internal tables. Add no
per-helper or per-command tests.

The independent reviewer must create its own set names and operation sequence,
including at least one unresolved entity, removal, rename, and set difference.

## Acceptance criteria

- Runs preserve public operation inputs, outcomes, result identifiers, reasons,
  and diagnostics without UI state.
- Saved sets survive database close and reopen.
- Every derived membership is explainable from explicit selection, a run,
  another set, or stored relationship evidence.
- Expansion and set operations are deterministic and bounded.
- Input sets are not mutated by union, intersection, or difference.
- Missing local evidence remains representable.
- CLI output is structured and failures are useful and non-zero.
- The schema and API remain focused on research paths rather than generalized
  application state.
- Reference-client behavior and source remain unchanged.
