# 001 — Begin with a UI-independent library and SQLite research memory

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

The first client was a Solid/browser experiment. Its useful behaviors were
interwoven with reactive state, browser APIs, IndexedDB and localStorage,
routing, notifications, rendering, application callbacks, and module-global
state. It was later removed after its useful lessons were recorded; it did not
establish a usable public boundary or settle its heuristics.

A research tool needs durable evidence, source visibility, and repeatable
local investigation rather than a transient feed session. Starting with SQLite
allows production callers and functional verification to exercise the same
storage path, while a UI-independent library permits the reference client,
CLI, and future interfaces to consume the same research capabilities.

## Consequences

- Library work must expose user-facing behavior through public library or CLI
  boundaries, not through Solid controllers or browser-only stores.
- Evidence provenance and reasons for a result or set membership are observable
  output, rather than incidental implementation state.
- Experimental databases may be discarded and regenerated. No schema
  compatibility or migration commitment exists during this phase.
- Lessons from application experiments may be retained without retaining their
  implementation or treating their behavior as authoritative.
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
