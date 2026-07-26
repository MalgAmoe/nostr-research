---
id: 028-prune-inactive-research-api
status: ready
max_attempts: 5
validation: workflow/tasks/028-prune-inactive-research-api.validate.sh
depends_on: 027-explicit-acquisition-budgets
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Prune inactive research records and shallow APIs

## Objective

Reduce the library to the capabilities exercised by the current research loop:
bounded evidence, observations, local selection, account resolution, protocol
relationships, traversal, acquisition, expansion, reply contexts, and retained
selections.

Delete abstractions whose complexity disappears when they are removed. There
is no legacy compatibility requirement for this experimental package.

## Remove

- process-local research runs, including recording, lookup, listing,
  normalization, subjects, projection, session initialization, and run-to-set
  conversion;
- the global acquisition-coverage registry and its record/get/list/query
  methods;
- generic set construction, member mutation, member explanation, set
  expansion, and set algebra;
- the core `load` alias;
- the lower-level public `searchEvents` result shape when `select` supplies the
  compositional collection;
- fixed `relatedEvent` and `relatedAccount` wrappers around resolve/traverse;
  and
- the duplicate `summary` method when `describe` is authoritative.

## Preserve

- Complete coverage information returned directly by every acquisition. It
  must still describe the request, budgets, relay outcomes, observations,
  uncertainty, and completion without registering a global history record.
- Observation provenance stored with resident canonical events.
- Result collections and their reasons/context.
- Retaining an explicit result collection with reasons.
- Reading, listing, renaming, and deleting retained selections.
- Traversal, thread interpretation, inspection, projection, expansion, and
  reply-context behavior that does not depend on removed record types.
- Atomic validation of retained selections.

Update subject validation, reset/close behavior, presentation, session
adaptation, documentation, exports, and tests so removed concepts do not remain
as dormant compatibility branches.

## Boundaries

- Do not replace runs or coverage history with another history abstraction.
- Do not introduce repository, service, storage, or adapter layers.
- Do not reorganize files merely to reduce line counts.
- Do not remove returned acquisition coverage or retained selections.
- Delete tests that only preserve removed interfaces. Keep functional coverage
  of the surviving research loop and focused protocol rules.

## Acceptance criteria

- The removed methods and record/subject types are absent from active source,
  exports, README, and canonical context.
- Acquisition still returns complete attempt coverage without storing an
  attempt registry in the corpus.
- A caller can acquire, select, traverse, inspect, expand, resolve reply
  contexts, retain a collection, and reopen that retained selection within the
  same process.
- The public core surface has one canonical local event-selection operation.
- No replacement architecture or compatibility facade is introduced.
- Functional tests and syntax checks pass.
