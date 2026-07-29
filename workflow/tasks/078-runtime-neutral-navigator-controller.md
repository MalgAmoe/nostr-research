---
id: 078-runtime-neutral-navigator-controller
status: ready
max_attempts: 4
validation: workflow/tasks/078-runtime-neutral-navigator-controller.validate.sh
depends_on:
protected_paths: packages/nostr-research/src packages/nostr-research/test
---

# Build the runtime-neutral navigator controller

## Context

Direct voyages through the JSONL session proved that the research engine is
usable but leave mechanical work to every caller: command IDs, response
correlation, revision awareness, bounded transcripts, handle-catalog
visibility, and compact command receipts.

The inspected design is
[NEUTRAL-CONTROLLER-PROPOSAL.md](../../NEUTRAL-CONTROLLER-PROPOSAL.md). The
controller is caller-side infrastructure. It must consume the existing
structured session protocol without becoming another executor, validator,
workflow language, vessel, or presentation engine.

## Goal

Create one small browser-compatible controller core over an injected
asynchronous request function.

## Work

1. Add a new workspace package at `packages/nostrarium-controller`.
2. Export a runtime-neutral `createNavigatorController` factory from its root
   entry point. The production controller core must not import Node built-ins
   or private research-engine modules.
3. Accept:
   - an injected `request(command)` function;
   - an optional asynchronous `closeTransport` callback;
   - explicit bounded transcript configuration.
4. Expose only:
   - `execute(commandDraft)`;
   - `state()`;
   - `transcript(options)`;
   - `synchronize()`;
   - `close()`.
5. `execute` must:
   - serialize dispatch;
   - reject caller-provided `commandId` rather than resolving collisions;
   - generate one stable unique command ID;
   - send the otherwise unchanged command;
   - require a plain structured response carrying the same command ID;
   - record exact structured command and response snapshots;
   - update the latest observed session revision;
   - resolve protocol responses including `ok: false`;
   - reject transport/correlation failures after recording them;
   - return `{ response, receipt }` without mutating the engine response.
6. The mechanical receipt may expose only response-declared facts:
   - command ID and success;
   - revisions before and after, and whether revision changed;
   - acknowledged handle identity, kind, count, and scope when present;
   - external status and reached bounds when present;
   - warning count and warning text;
   - semantic error code and message.
   It must not issue follow-up observations or interpret evidence.
7. Keep a bounded in-memory verbatim transcript with sequence, exact command,
   exact response or transport failure, start/end timestamps, and duration.
   Enforce both entry and serialized-byte bounds with visible omitted-entry and
   omitted-byte accounting. If one entry cannot fit, return its response to the
   caller but omit it from retained history and account for that omission; do
   not exceed the bound.
8. `state` must expose controller lifecycle, observed revision, pending
   command IDs, transcript accounting, latest transport failure, and the last
   synchronized handle catalog with its synchronization revision. It must not
   introduce a current research selection.
9. `synchronize` must issue ordinary transcript-visible `list` and `status`
   commands in sequence, update the catalog only from the successful `list`
   response, label its revision, and return both command outcomes. Do not
   automatically synchronize after other commands.
10. `close` must issue one ordinary visible `close` command, record it, invoke
    the optional transport closer, become idempotently closed, and prevent new
    commands. Do not invent alternate engine lifecycle semantics.
11. Add concise package documentation describing the boundary and public
    interface. Do not duplicate the research operation reference.

## Acceptance criteria

- The package core is browser-compatible and contains no Node runtime imports.
- The controller operates through only the injected request boundary.
- Commands are sequential, correlated, and visible without rewritten research
  syntax.
- Engine responses are preserved unchanged and returned beside bounded
  mechanical receipts.
- Protocol `ok: false` and transport failure remain distinct.
- Transcript limits are enforced honestly, including an individually
  oversized entry.
- Catalog staleness is visible and catalog truth comes only from `list`.
- No hidden `show`, acquisition, synchronization, ranking, judgment, or vessel
  policy is introduced.
- The existing research-engine source and tests remain unchanged.

## Non-goals

- Node subprocess or browser Worker transports.
- UI, shell syntax, recipes, journey annotations, transcript persistence, or
  transcript export.
- Schema caching or schema-to-form generation.
- Controller-owned validation of operation parameters.
- Parallel commands, automatic `ifRevision`, retries, automatic observations,
  or current-selection state.
- New research-engine APIs or response fields.

## Verification

- Permanent tests expected: yes, a small number of public controller-boundary
  functional scenarios.
- Stable public behavior protected: sequential correlation, unchanged
  responses, receipts, bounded transcript omissions, explicit synchronization,
  protocol failure, transport failure, and close lifecycle.
- Temporary task validation or field evidence: run the package check plus the
  complete repository functional suite.
- Explicitly excluded test levels or mechanisms: private transcript-helper
  tests, WebSocket tests, live relays, exhaustive malformed-input matrices, and
  changes to research-engine tests merely to exercise the controller.

