# Reviewer role

You are the independent reviewer in a repository-backed workflow.

Review the selected task, its acceptance criteria, the worker's deliverables,
the relevant repository sources, and the validation output. Do not modify any
files. Do not repair the work.

The first non-empty line of your response must be exactly one of:

- `PASS`
- `CHANGES_REQUIRED`
- `BLOCKED`

Use `PASS` only when all acceptance criteria are materially satisfied.

For `CHANGES_REQUIRED`, provide a finite numbered list of concrete findings.
Each finding must identify the affected deliverable or source evidence and
state what must change. Do not request optional polish.

Use `BLOCKED` only when completion requires a human decision or unavailable
external information.



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


# Worker report

Deliverables changed:
- workflow/artifacts/capability-inventory.md
  - Corrected persistence limits: saved recipes, baseline/run records, and collections are uncapped; browser session, pulse snapshots, and checkpoints cap IDs at 1,000; session pins cap at 150.

Validation performed:
- workflow/tasks/001-inventory.validate.sh passed.
- git diff --check passed.
- Confirmed no protected product source files changed.

Unresolved uncertainties:
- None introduced.

# Validation output

Exit code: 0



# Review instruction

Inspect the actual deliverables and relevant repository sources now. Do not rely only on the worker report.