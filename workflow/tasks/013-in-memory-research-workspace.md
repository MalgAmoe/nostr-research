---
id: 013-in-memory-research-workspace
status: ready
max_attempts: 5
validation: workflow/tasks/013-in-memory-research-workspace.validate.sh
depends_on: 012-research-sessions-and-coverage
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add a bounded in-memory research workspace

## Objective

Make an in-process corpus the active environment for iterative research while
retaining SQLite as the current durable evidence store.

This is not a second permanent data model and not a generic storage backend.
It is a bounded, disposable working set that can be rebuilt from memory,
incrementally updated, and searched or navigated repeatedly without returning
to SQLite for every step.

## Runtime model

Expose one cohesive public workspace entry point. It must:

- attach to an open `ResearchMemory`;
- explicitly load a caller-selected, bounded slice of stored canonical events;
- incrementally accept newly acquired or explicitly selected stored evidence;
- deduplicate canonical events by event ID;
- preserve relay observations and relationship interpretation;
- maintain useful indexes for event ID, author, kind, tags, and inbound/outbound
  relationships;
- expose counts and bounds without dumping the corpus; and
- enforce a caller-visible event capacity with deterministic eviction.

The workspace is temporary. Closing it must not delete durable evidence.
Opening a new workspace over the same SQLite memory must reproduce the selected
working corpus.

## Operations

Provide a small composable surface that covers the actual research loop:

- load or add evidence;
- select events using the existing meaningful query constraints;
- turn results into the shared result-collection vocabulary;
- traverse stored relationships in either direction with explicit depth and
  limits;
- inspect a subject with canonical evidence and provenance; and
- retain a chosen collection through the attached durable memory.

Reuse existing query validation, subject vocabulary, relationship semantics,
and projections where they remain appropriate. Do not create subtly different
meanings for the same public terms.

The workspace may call SQLite for explicit persistence, corpus loading, or
evidence detail that was not loaded. Ordinary repeated selection and traversal
over the loaded corpus must operate on the in-memory structures.

## Boundaries

- SQLite remains the only persistence implementation.
- Do not introduce a generic database adapter, ORM, HTTP API, worker protocol,
  UI, ranking system, or discovery heuristic.
- Do not attempt to hold an unbounded relay or the whole Nostr network.
- Do not duplicate the complete `ResearchMemory` method surface.
- Do not expose internal maps as mutable public state.
- Keep implementation cohesive; do not split every index into its own class.

## Documentation

Document the distinction between durable research memory, the temporary
in-memory workspace, reusable result collections, and sessions. Update
`CONTEXT.md` only with vocabulary that is settled by the implementation.

## Verification

Add one public functional scenario that:

- stores a corpus large enough to exercise the capacity;
- loads a bounded workspace and verifies deterministic contents;
- performs repeated text/author/tag selection and bidirectional traversal;
- incrementally introduces new stored evidence and deduplicates it;
- retains a workspace result;
- closes and recreates the workspace from SQLite; and
- proves evicted workspace events remain durable.

Do not add tests for private maps or individual index helpers.

## Acceptance criteria

- In-memory corpus size is explicitly bounded.
- Selection and traversal over loaded evidence do not query SQLite per step.
- Results remain compatible with sessions, projection, and retention.
- Relay observations and relationship explanations remain available.
- Workspace eviction never deletes SQLite evidence.
- Existing library and CLI behavior remain usable.
- Permanent verification stays at the public functional boundary.
