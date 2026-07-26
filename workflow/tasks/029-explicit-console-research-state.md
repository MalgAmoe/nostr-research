---
id: 029-explicit-console-research-state
status: done
max_attempts: 5
validation: workflow/tasks/029-explicit-console-research-state.validate.sh
depends_on: 028-prune-inactive-research-api
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make console research state explicit and finish the cleanup

## Objective

Make the persistent JavaScript console predictable: research operations return
values, and changing the active investigation is an explicit operation. Then
simplify session and presentation code around the smaller data model delivered
by task 028.

## Required behavior

- Local query, acquisition, expansion, reply-context resolution, filtering,
  facets, comparison, inspection, and traversal do not implicitly replace the
  active selection.
- One plainly named operation explicitly makes a result the active selection.
- Explicit traversal has one signature and one mutation behavior; do not
  overload argument count to switch between stateful and stateless operation.
- Retaining an explicit result and checkpointing the active selection have
  distinct names and signatures.
- Console status reports one authoritative corpus description rather than
  duplicate memory/corpus summaries.
- Closing the environment still cancels operations it owns.

Review the temporary session against actual console use. Keep a session module
where it contains genuine active-navigation state, but remove unused
focus/include/exclude/branch/view machinery if its complexity does not reappear
in the console. Do not preserve operations solely because old tests call them.
Backtracking or checkpoint behavior may remain only if it has a clear,
non-overloaded console operation.

Simplify presentation after removed run, coverage-registry, and generic-set
shapes disappear. Compact traversal and expansion output should summarize
relationship evidence by default rather than embedding large nested reason
structures; detailed inspection must remain available on request.

Finally reassess source locality. Extract a module only when it owns a coherent
implementation concern and makes callers simpler. Leaving the reduced core in
one file is acceptable; creating pass-through modules is not.

## Boundaries

- Do not add a UI, command language, database, persistence, browser bundler, or
  plugin/widget system.
- Do not rename the entire memory/corpus vocabulary as cosmetic churn.
- Do not introduce controllers, services, repositories, dependency injection,
  or generic adapters.
- Keep dynamic JavaScript composition and the process-lifetime REPL.
- Test public console workflows and protocol rules, not helper implementation
  details.

## Documentation and verification

Update active README, console help, and canonical context to describe the exact
remaining console operations and explicit state rule.

Run a console-driven functional scenario that:

1. imports or acquires evidence;
2. performs multiple local queries without changing active state;
3. explicitly activates one result;
4. traverses it without hidden mutation;
5. explicitly activates the traversal;
6. retains findings; and
7. inspects both compact and detailed output.

## Acceptance criteria

- Console operations have predictable mutation semantics.
- There are no overloads whose argument count changes whether session state is
  mutated.
- Session code contains only capabilities available and useful through the
  active console workflow.
- Compact presentation is bounded and detailed evidence remains inspectable.
- Documentation matches the actual interface.
- No speculative architecture is introduced.
- Functional tests, syntax checks, and the console scenario pass.
