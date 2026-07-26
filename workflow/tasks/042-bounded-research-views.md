---
id: 042-bounded-research-views
status: ready
max_attempts: 4
validation: workflow/tasks/042-bounded-research-views.validate.sh
depends_on: 041-selection-driven-navigation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded evidence views for research decisions

## Objective

Make a named result understandable without dumping its full contents or
encoding conclusions that belong to the human or agent.

## Work

Build bounded projections over existing canonical evidence and collection
operations:

- orientation for a newly acquired or derived buffer;
- account evidence;
- topic/tag/domain evidence;
- conversation context;
- comparison between compatible results;
- long-tail as well as top facets;
- corpus pressure, retained evidence, and eviction effects.

Keep the established distinction:

- `show` describes a named result;
- `inspect` describes current canonical evidence for a subject;
- `explain` describes why a subject belongs to a result.

Views must report population, sampling/ordering method, truncation, omissions,
and evidence freshness. Prefer composing shared projections over introducing
parallel research semantics.

Do not rank people by an opaque quality score, classify identities, summarize
with an external model, or create UI-specific response structures.

## Acceptance criteria

- A caller can orient itself from a new buffer using bounded output.
- Account, topic, conversation, and comparison views expose enough evidence
  to choose a next navigation command.
- Top facets cannot hide the existence of a meaningful long tail.
- All views remain bounded and structurally report truncation and corpus
  effects.
- View construction does not duplicate collection or traversal semantics.

## Verification

- Permanent tests expected: no new unit tests; extend a public session
  functional scenario only if needed to protect bounded projection contracts.
- Stable public behavior protected: `show`/`inspect`/`explain` separation,
  bounds and omission metadata.
- Temporary task validation or field evidence: orient from one noisy live
  buffer and record the next decision enabled by each useful view.
- Explicitly excluded test levels or mechanisms: visual/UI tests, snapshotting
  full output, live network tests in the permanent suite.
