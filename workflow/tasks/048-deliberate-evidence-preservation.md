---
id: 048-deliberate-evidence-preservation
status: done
max_attempts: 4
validation: workflow/tasks/048-deliberate-evidence-preservation.validate.sh
depends_on: 047-post-consolidation-cleanup-and-live-trial
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Separate the observation buffer from deliberate evidence preservation

## Objective

Implement the storage ownership and evidence-resolution contract in
`workflow/artifacts/research-memory-milestone.md` without changing the
declarative research model into a database or persistence abstraction.

The observation buffer must remain renewable. Evidence must survive buffer
turnover only through an explicit archive mutation.

## Work

- Refactor the existing memory module so the indexed canonical corpus is named
  and treated as the observation buffer rather than the whole research memory.
- Add one memory-owned evidence archive with explicit `reference`, `excerpt`,
  and `canonical` preservation levels.
- Keep archive capacity/configuration simple and explicit. A full archive must
  reject preservation atomically; acquisition must never evict archive
  entries.
- Define one authoritative resolver across archive and buffer. Return current
  resolution source (`archive`, `buffer`, or `unresolved`) and do not cache a
  stale residency boolean in public evidence.
- Select current replaceable events across all complete available evidence
  using the existing Nostr ordering rule. Merge observation provenance without
  duplicating or rewriting canonical events.
- Add normalized declarative/session operations to preserve, inspect/list, and
  release archived evidence. Operation discovery, plan execution, individual
  commands, handles, and revisions must agree.
- Make failure atomic and keep release of handles distinct from release of
  archived evidence.
- Remove or absorb acquisition's one-call `preserve` behavior if the explicit
  archive makes it misleading. Do not preserve a compatibility alias.

Do not yet redesign annotations, retained selections, or relation row
ownership beyond what is required to make resolution correct.

## Acceptance criteria

- Filling and turning over the buffer cannot delete explicitly archived
  evidence.
- Unpreserved evidence becomes unresolved after eviction.
- Reference, excerpt, and canonical archive entries are observably distinct;
  excerpts are never exposed as canonical Nostr events.
- Current profile/event resolution is correct across buffer and archive.
- Archive limit failures and invalid preservation requests leave all stores
  unchanged.
- Session mutation revisions and lifecycle commands reflect archive changes.
- No persistence, database, storage adapter hierarchy, or automatic
  preservation is introduced.

## Verification

- Permanent tests expected: yes, one public memory/session functional scenario
  covering explicit preservation, complete buffer turnover, resolution source,
  archive release, and atomic capacity failure.
- Stable public behavior protected: canonical validation, acquisition budgets,
  normalized operations, session envelopes, reset/close lifecycle.
- Temporary task validation or field evidence: deterministic turnover with a
  very small buffer and archive.
- Explicitly excluded test levels or mechanisms: private store helpers, one
  test per preservation level, live relays, WebSocket transport, UI, database,
  and compatibility tests for the old ingest `preserve` option.
