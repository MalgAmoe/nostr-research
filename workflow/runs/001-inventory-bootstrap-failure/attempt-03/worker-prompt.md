# Worker role

You are the implementation worker in a repository-backed workflow.

Read `workflow/WORKFLOW.md` and the selected task completely. Treat the task
definition, its scope, and its acceptance criteria as authoritative.

Work directly in the repository. Produce every required deliverable. Inspect
real source and tests rather than relying on assumptions. Do not change task
status, files under `workflow/runs/`, or the workflow runner.

If a previous review is supplied, address every applicable finding explicitly.
Do not merely describe work that should be done: perform the task within its
stated permissions.

Finish with a concise plain-text report listing:

- deliverables created or changed;
- validation or checks performed;
- unresolved uncertainties.



# Selected task

---
id: 001-inventory
status: in_progress
max_attempts: 4
validation: workflow/tasks/001-inventory.validate.sh
depends_on:
protected_paths: src server.mjs index.html vite.config.js package.json package-lock.json
---

# Inventory the reference application's capabilities

## Objective

Create a behavioral inventory of the existing Nostr research application before
it is packaged as a reference implementation.

The inventory will guide a later clean library build. It must describe what the
software can do, not mirror its UI component tree or prematurely prescribe the
final library architecture.

## Scope

- Inspect the complete repository, including tests and persistence behavior.
- Product code is read-only for this task.
- Workflow artifacts may be created or updated.
- Do not move the application.
- Do not propose a final public API.
- Do not label code reusable merely because it already exists.

## Required deliverables

### `workflow/artifacts/capability-inventory.md`

Group capabilities by behavior. For every capability record:

- what it does from a caller's perspective;
- its inputs and observable outputs;
- important protocol semantics or limits;
- state or persistence involved;
- current implementation locations;
- current test coverage;
- whether it appears suitable for extraction, should be recreated cleanly, is
  UI/application coordination, or is questionable/obsolete;
- uncertainties or contradictions.

At minimum cover relay access, query construction, search modes, account and
event resolution, corpus set operations, local archive behavior, relationship
navigation, protocol interpretation, moderation, persistence, portability,
relay exploration, analysis, provenance, rendering-related data preparation,
and logging.

### `workflow/artifacts/current-dependency-map.md`

Describe the current functional dependency directions and identify where
otherwise useful behavior depends on Solid state, browser APIs, module globals,
or application orchestration. Use paths and exported symbol names where
possible.

### `workflow/artifacts/open-questions.md`

Record only questions that materially affect the later library boundary or
behavior. Separate factual questions that can be answered from the repository
from product decisions that require human judgment.

## Acceptance criteria

- Every externally visible application capability is represented.
- Important hidden protocol, persistence, provenance, and moderation behavior
  is represented.
- Capabilities are organized independently of UI regions.
- Each material claim is traceable to current source files or tests.
- Existing code is not automatically treated as the desired design.
- Contradictory or unreliable current behavior is called out explicitly.
- The dependency map reveals coupling that matters to extraction.
- Open questions are specific and do not substitute for repository analysis.
- No product source file is modified.
