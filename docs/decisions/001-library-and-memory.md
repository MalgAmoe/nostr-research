# 001 — Begin with a UI-independent library and SQLite research memory

Status: superseded by the bounded in-memory runtime adopted in tasks 024–026.

This record preserves the initial architectural decision. It is not a
description of the current implementation; see `CONTEXT.md` for the active
project boundaries.

## Decision

Begin the rebuild with a UI-independent Nostr research library backed by
SQLite. The library is the common foundation for a CLI, functional
verification, and later applications. SQLite is the real storage path for all
of them; the project will not maintain an in-memory production or functional
verification substitute.

The library keeps raw, valid Nostr events as immutable evidence and records
their observable acquisition provenance. Search indexes, relationship views,
and other interpretations are derived, reproducible, and replaceable. Relay
acquisition and queries over local research memory are separate operations so
callers can compose them without making a UI session or a relay request the
domain model.

## Why

A research tool needs durable evidence, source visibility, and repeatable
local investigation. Starting with SQLite allows production callers and
functional verification to exercise the same storage path, while a
UI-independent library lets agents, the CLI, and future adapters compose the
same research capabilities.

## Consequences

- Library work must expose behavior through public library or CLI boundaries.
- Evidence provenance and reasons for a result or set membership are observable
  output, rather than incidental implementation state.
- Experimental databases may be discarded and regenerated. No schema
  compatibility or migration commitment exists during this phase.
- Functional verification uses real SQLite. Permanent unit tests are limited
  to stable protocol rules, cryptography, and precise algorithms worth
  freezing; tests should not import private helpers or cement internals.

## Deliberately undecided

This decision does not define a final API, permanent SQLite schema, ranking
method, UI, or complete architecture. The project still needs product choices
about event validation and trust, relay reliability and metadata policy,
provenance granularity, relationship and pagination semantics, moderation,
portability, telemetry, and which present heuristics deserve to survive.

SQLite is settled as the experimental real path; its future adapter surface,
multi-process behavior, and longer-term compatibility policy are not.
