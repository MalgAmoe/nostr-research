---
id: 004-sqlite-memory-foundation
status: done
max_attempts: 5
validation: workflow/tasks/004-sqlite-memory-foundation.validate.sh
depends_on: 003-separate-reference-application
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Build the SQLite research-memory foundation

## Objective

Build the first usable UI-independent library slice using the same real SQLite
storage path that the CLI, functional verification, and future applications
will use.

This task proves storage and ingestion through observable behavior. It does not
design the complete research system.

## Required behavior

Through the public library boundary:

- create or open a SQLite research-memory file;
- deliberately reset a disposable database;
- accept a valid canonical Nostr event;
- reject an event whose ID, signature, or required event structure is invalid;
- store one canonical raw event per event ID;
- record independently where and when the event was observed;
- ingesting the same event from another relay must not duplicate the event and
  must retain the additional observation;
- retrieve an event with its observations;
- import reproducible fixture events;
- report useful database counts without knowledge of internal tables.

Expose a minimal CLI that exercises the same public library boundary:

- initialize/open a database;
- reset it explicitly;
- import fixture events with a supplied relay observation;
- inspect one event and its provenance;
- print summary counts.

Commands and output should be discoverable and suitable for later Codex-driven
research workflows.

## Storage and fixture constraints

- Use SQLite directly; do not create an in-memory repository implementation.
- Prefer the runtime's supported SQLite capability when it is adequate; do not
  add a native dependency without a demonstrated need.
- Keep the schema minimal to this task: canonical events, observations, and
  only essential schema metadata.
- Store the raw event without losing tags or content.
- Database files are generated artifacts and ignored by Git.
- Fixture source must be plain, inspectable, reproducible data or a deterministic
  generator. Do not treat a committed opaque SQLite file as the source fixture.
- No migration or backward-compatibility framework is required.
- Do not yet introduce research runs, research sets, profile resolution,
  relationship indexes, ranking, relay networking, or UI integration.

## Verification policy

- Add permanent unit tests only for a difficult protocol invariant if the
  runtime or trusted Nostr library does not already establish it.
- Add one small black-box functional test or executable acceptance scenario
  using the public library/CLI and a temporary real SQLite file.
- Do not import private helpers, query internal tables, assert SQL statements,
  or freeze the module layout.
- The reviewer must independently operate the public CLI against a disposable
  database and inspect observable results.

## Acceptance criteria

- Library consumers do not need to know the SQLite schema.
- The same SQLite implementation is used by the CLI and functional
  verification.
- Canonical-event deduplication and multi-relay provenance work observably.
- Invalid Nostr events do not enter memory.
- The database can be discarded and recreated from fixture sources.
- CLI failures use non-zero exit status and useful error messages.
- Public resources are closed cleanly so commands and tests terminate.
- The package remains small and has no UI or Solid dependency.
- Reference-client behavior and source remain unchanged.
