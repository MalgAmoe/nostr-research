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
id: 002-project-contract
status: in_progress
max_attempts: 4
validation: workflow/tasks/002-project-contract.validate.sh
depends_on: 001-inventory
protected_paths: src server.mjs index.html vite.config.js package.json package-lock.json
---

# Establish the canonical project contract

## Objective

Create concise durable context for every future worker and reviewer before the
repository is reorganized or the research library is built.

The document must state settled principles clearly while preserving uncertainty
where experimentation is still required. It must not prescribe a final public
API, permanent database schema, or complete future architecture.

## Sources

- `workflow/artifacts/capability-inventory.md`
- `workflow/artifacts/current-dependency-map.md`
- `workflow/artifacts/open-questions.md`
- `workflow/ROADMAP.md`
- the selected task and workflow rules

## Required deliverables

### `CONTEXT.md`

Define:

- the project's purpose as a tool for research, navigation, and exploration of
  Nostr rather than a conventional feed client;
- the UI-independent library as the product foundation and user interfaces as
  consumers;
- the current Solid application as a behavioral reference whose code and
  behavior may be retained, recreated, or rejected deliberately;
- SQLite as the one real storage path for the library, CLI, functional
  verification, and future applications;
- raw valid Nostr events as immutable source evidence;
- derived indexes and interpretations as reproducible and replaceable;
- relay acquisition and local-memory querying as distinct, composable
  operations;
- provenance and reasons for result inclusion as observable research output;
- disposable/regenerable databases and no compatibility or migration burden
  during the experimental phase;
- the boundary between settled principles and open product decisions;
- concise shared terminology for event, observation, memory, acquisition,
  query, research run, research set, provenance, and derived relationship.

Include the testing policy:

- permanent unit tests are reserved for difficult stable protocol rules,
  cryptographic behavior, and precise algorithms worth freezing;
- functional tests exercise public library or CLI boundaries using real SQLite;
- there is no automatic requirement to add a test for each feature or bug;
- tests must not import private helpers or freeze internal architecture;
- task validation and fresh-agent exploratory scenarios may be temporary run
  artifacts rather than permanent tests;
- live relay checks are task validation when network behavior is under review,
  not an always-on brittle test suite.

### `docs/decisions/001-library-and-memory.md`

Record why the project is beginning with a UI-independent library and SQLite
research memory, the consequences of that decision, and what remains
deliberately undecided. Do not create multiple decision records for the same
choice.

### Workflow consistency

Update `workflow/WORKFLOW.md` only if the new canonical context exposes a direct
contradiction. Do not duplicate the complete context into workflow
documentation.

## Acceptance criteria

- A fresh worker can understand the project direction without conversation
  history.
- Settled decisions and unresolved design questions are visibly distinct.
- The testing policy matches the selected task exactly and discourages
  implementation-coupled test growth.
- SQLite is the real path used by production and functional verification; no
  in-memory substitute is proposed.
- The documents do not prematurely define a final API, schema, ranking method,
  or UI.
- Material statements are consistent with the reviewed inventory.
- No product source or package file is modified.
