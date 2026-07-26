---
id: 026-remove-sqlite
status: ready
max_attempts: 5
validation: workflow/tasks/026-remove-sqlite.validate.sh
depends_on: 025-single-corpus-runtime
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Remove SQLite and obsolete persistence assumptions

## Objective

Delete the superseded SQLite implementation and finish the milestone with one
simple Node-based, in-memory JavaScript research library.

This task removes storage and persistence complexity. It does not attempt the
separate future milestone of removing all Node dependencies.

## Remove

- `node:sqlite` and every SQL statement;
- schema creation, schema versions, migrations, foreign keys, and transaction
  wrappers;
- database paths and database-path public state;
- the old SQLite memory and any temporary migration oracle;
- the separate `ResearchWorkspace` implementation and factory;
- comparison-only code introduced by task 024;
- console/database startup arguments;
- documentation claims about durable evidence, reopening, or SQLite fallback;
  and
- tests whose only product requirement is persistence across close/reopen.

Do not remove underlying same-process capabilities merely because their old
tests used reopening. Rewrite those scenarios around the active process where
they still prove:

- canonical deduplication and independent observations;
- selection and account resolution;
- replaceable-event and relationship semantics;
- traversal and projection;
- acquisition coverage;
- runs;
- retained groups, reasons, expansion, and combination;
- sessions and checkpoints; and
- bounded corpus behavior.

Bulk mutations must validate and prepare before committing. Do not reproduce a
transaction API solely to imitate SQLite.

## Documentation

Update `CONTEXT.md`, package metadata, package README, workflow roadmap, console
help, and relevant comments to state:

- memory is a bounded process-local research corpus;
- persistence and database format are deliberately absent;
- closing, resetting, or ending the process loses resident state;
- retained groups, runs, and coverage exist only for the running process; and
- removing remaining Node dependencies is a separate future milestone.

Historical completed task definitions and committed field-trial artifacts are
historical records. Do not rewrite them merely because they describe the
architecture that existed when they ran.

## Boundaries

Do not add IndexedDB, OPFS, localStorage, snapshot import/export, a persistence
interface, storage adapter, browser bundler, worker, Rust/Wasm, or database
replacement.

Do not remove `node:fs`, `node:crypto`, `ws`, the console, or Node test
infrastructure unless a particular import is dead after SQLite deletion.

## Verification

- Run the complete functional suite and syntax checks.
- Search the production package for SQLite imports, SQL, database paths, and
  active workspace terminology.
- Run a real persistent-console process that creates a bounded corpus, imports
  fixtures, searches, traverses, inspects, retains a group, and exits.
- Confirm a fresh process starts empty; this is expected behavior, not a
  regression.
- Confirm the package dependency tree contains no SQLite package introduced as
  a replacement.

## Acceptance criteria

- Production code contains no SQLite implementation or SQL.
- No database path is required or exposed.
- Exactly one authoritative in-memory corpus owns resident evidence.
- Same-process research capabilities remain available.
- Persistence-specific tests and claims are removed without preserving
  accidental architecture.
- No replacement database or storage abstraction is introduced.
- Documentation and canonical context describe the new runtime truth.
- The complete functional suite, syntax checks, and console field verification
  pass.

