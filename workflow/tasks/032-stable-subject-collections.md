---
id: 032-stable-subject-collections
status: ready
max_attempts: 4
validation: workflow/tasks/032-stable-subject-collections.validate.sh
depends_on: 031-production-interface-cleanup
protected_paths: workflow/run.py workflow/prompts workflow/artifacts/declarative-operations-field-trials.md
reviewer_sandbox: workspace-write
---

# Make collections stable by subject identity

## Objective

Correct the collection identity flaw exposed by Trial 4 before adding a
declarative operation layer.

Collections must remain meaningful when the canonical evidence for one of
their subjects gains observations, changes current replaceable metadata, or is
evicted. Stable subject identity, reasons, and evidence references are the
durable collection state. Canonical records are resolved from the current
corpus when an operation needs them.

## Required behavior

- A collection selected before a duplicate event is observed on another relay
  remains accepted by all collection operations afterward.
- A collection containing an account remains accepted after newer kind-0
  metadata or additional provenance is ingested.
- Resident operations use the current canonical event or profile rather than
  a stale embedded snapshot.
- A retained subject remains inspectable after eviction and explicitly reports
  that resident evidence is absent.
- Public callers cannot fabricate canonical event/profile evidence or
  provenance by constructing a collection item.
- Reasons attached to a collection item survive re-resolution.

## Consistent access

Provide one direct exact-subject lookup/selection path for event and account
subjects so callers do not query hundreds of accounts and filter by ID in
JavaScript. Keep raw inspection and its console presentation consistent about
the `resident` state.

Do not add prefix aliases or broad convenience search APIs.

## Boundaries

- Do not add the declarative plan language in this task.
- Do not add persistence, a database abstraction, Rust, or a UI.
- Do not remove provenance, evidence, reasons, annotations, or bounded
  eviction.
- Prefer deleting embedded-record validation/state when stable resolution
  makes it unnecessary; do not add a versioning framework.
- Add one focused functional regression scenario covering stale collections,
  current resolution, and eviction. Do not add unit tests for individual
  helpers or object shapes.

## Acceptance criteria

- The exact Trial 4 failure mode no longer occurs.
- Collection operations resolve current resident evidence by subject identity.
- Exact event/account access does not require a broad query plus handwritten
  filtering.
- Inspection consistently distinguishes resident evidence from a retained
  reference.
- Existing functional behavior remains intact.
- Documentation describes collections as subject/reason references rather than
  immutable embedded canonical records.
- Functional tests and syntax checks pass.
