---
id: 031-production-interface-cleanup
status: done
max_attempts: 4
validation: workflow/tasks/031-production-interface-cleanup.validate.sh
depends_on: 030-acquisition-and-reactivation-correctness
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Remove test fixtures and ignored options from the production interface

## Objective

Finish the post-refactor cleanup by deleting two shallow production
conveniences and checking the reduced interface for related dead surface.

## Fixture loading

Remove production `importFixtures()` and `loadFixtureEvents()` capabilities.
Move fixture-file reading into test support and make functional tests ingest
fixtures through the same public `ingest()` seam available to real callers.

The production package source must no longer import `node:fs` solely for test
data. This is a local cleanup, not the complete Node/browser portability
milestone.

## Inspection options

The console `inspect()` operation currently accepts an options argument that
the memory inspection implementation ignores. Remove the ignored parameter and
document the actual split:

- `inspect(subject)` returns raw orientation/evidence information;
- `show(value, options)` owns bounded presentation and detailed evidence
  options.

Unknown or extra inspection behavior must not be advertised.

## Final narrow review

After these deletions, inspect imports, exports, package files, active
documentation, and functional tests for code made unreachable by tasks
027-030. Remove only directly evidenced dead surface. Do not reorganize stable
modules, rename the memory vocabulary, or invent new seams.

## Boundaries

- Do not remove the console, `ws`, `node:crypto`, Node test infrastructure, or
  other Node dependencies as part of this task.
- Do not add a fixture adapter or dependency injection seam.
- Do not add unit tests for fixture plumbing or function signatures.
- Do not change inspection semantics beyond removing the ignored options.

## Acceptance criteria

- Production source has no fixture-file loader, fixture importer, or
  `node:fs` import.
- Tests load fixture material from test support and exercise public ingestion.
- Console and documentation expose `inspect(subject)` without ignored options.
- `show(value, options)` remains the bounded presentation operation.
- No directly related dead imports, exports, documentation, or tests remain.
- Functional tests and syntax checks pass.
