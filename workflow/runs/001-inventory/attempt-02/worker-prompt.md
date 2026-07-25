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


# Latest independent review

CHANGES_REQUIRED

1. `workflow/artifacts/capability-inventory.md` lacks a capability record for private Seed Accounts. It only mentions seeds incidentally in persistence/export text, but does not inventory their caller-visible behavior, inputs/outputs, limits, state, locations, test coverage, assessment, and uncertainty. Add a record covering add/remove via hex/`npub`/`nprofile`, batch activity search (maximum 100 accounts), and Relay Explorer direction use (maximum eight accounts), with evidence from `src/app.jsx:469-486, 741-749`, `src/research-session.js:294-330`, `src/relay-explorer.js:28-57`, and `src/ui/settings-page.jsx:8`.

2. The local archive record does not call out a material query/index contradiction. `searchStoredEvents` accepts dotted terms (`/[\p{L}\p{N}_.-]{3,}/gu`), while `indexTerms` indexes content using `/[\p{L}\p{N}_-]{3,}/gu` and therefore does not index dots. A content query such as `foo.bar` can fail despite being accepted as a search term. Record this unreliable behavior under capability 2.4, with `src/research-store.js:97-140` as evidence.