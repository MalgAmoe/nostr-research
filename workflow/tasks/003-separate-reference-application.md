---
id: 003-separate-reference-application
status: done
max_attempts: 4
validation: workflow/tasks/003-separate-reference-application.validate.sh
depends_on: 002-project-contract
protected_paths: CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Separate the reference application

## Objective

Give the repository a simple physical boundary between the existing Solid
application and the new UI-independent library without changing application
behavior.

## Required result

Create this minimal shape:

```text
apps/
  reference-client/
packages/
  nostr-research/
workflow/
docs/
```

Move the existing application source, server, HTML, Vite configuration,
key-generation script, package metadata, runtime `keys/` and `logs/` locations
as appropriate into `apps/reference-client/`. Generated output, installed
dependencies, secrets, keys, and usage logs must not be committed or copied as
source assets.

Create a minimal root npm workspace that can run the reference client commands.
Reserve `packages/nostr-research/` without inventing its implementation in this
task. A short README or placeholder package description may establish its
purpose.

## Constraints

- Preserve reference-client runtime behavior and its existing commands.
- Do not refactor product modules while moving them.
- Do not make the reference client consume the future library.
- Do not introduce shared configuration packages, build orchestration
  frameworks, monorepo managers, or compatibility wrappers.
- Update repository paths in documentation, ignores, and scripts only where the
  move makes that necessary.
- Existing uncommitted source content belongs to the project and must be moved
  intact.

## Acceptance criteria

- The root clearly separates applications from packages.
- The reference client installs through the root workspace and can be started
  from an obvious root command.
- Its existing tests and production build pass from the reorganized repository.
- Its server and key-generation scripts pass syntax checks.
- No existing product source module or permanent test is deleted.
- Git ignores generated databases, dependencies, builds, keys, and logs at
  their new locations.
- `packages/nostr-research/` contains no speculative architecture.
- The resulting organization is understandable without wrapper scripts.
