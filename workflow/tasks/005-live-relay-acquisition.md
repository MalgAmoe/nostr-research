---
id: 005-live-relay-acquisition
status: ready
max_attempts: 5
validation: workflow/tasks/005-live-relay-acquisition.validate.sh
depends_on: 004-sqlite-memory-foundation
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Acquire real relay events into research memory

## Objective

Add one bounded, observable live-relay acquisition operation to the public
library and CLI. It must acquire real Nostr events from explicitly selected
relays and store them through the existing SQLite research-memory boundary.

This is acquisition, not search ranking or a research-session abstraction.

## Required public behavior

- Accept one or more explicit `wss://` relay URLs and one valid Nostr filter.
- Require a caller-controlled timeout and bounded total event count, with
  documented conservative defaults when omitted.
- Use bounded relay concurrency and allow an in-flight operation to be
  cancelled through the public library boundary.
- Handle NIP-01 `EVENT`, `EOSE`, `CLOSED`, connection failure, and timeout
  outcomes without treating them as equivalent.
- Validate every received event before persistence.
- Store valid canonical events through the existing memory implementation.
- Retain relay and observation-time provenance for every accepted observation.
- Deduplicate canonical events while retaining observations from distinct
  relays.
- Stop cleanly when the total limit, timeout, cancellation, or relay completion
  condition is reached.
- Close subscriptions and sockets owned by the operation.

Return a structured acquisition result containing:

- requested filter and relays;
- operation start and finish times;
- completion reason;
- acquired event IDs;
- per-relay outcome and useful diagnostics;
- received, invalid, duplicate, newly stored, and observation counts.

Counts and terms must be defined precisely enough that callers do not need to
infer their meaning from implementation details.

## CLI behavior

Add an `acquire` command to the existing CLI. It must support:

- repeated explicit `--relay` arguments;
- a Nostr filter supplied as JSON text or an explicitly named JSON file;
- database path, timeout, and total-event limit;
- machine-readable structured output;
- useful non-zero failures for malformed filters, invalid relay URLs, and
  unusable arguments.

Do not add a hidden default relay list. The caller must know which relays are
being contacted.

## Scope boundaries

- Do not add local text search, relationship indexes, research runs, saved
  sets, ranking, moderation policy, or UI integration.
- Do not copy the reference client's relay orchestration wholesale.
- Reuse a trusted Nostr protocol implementation where appropriate, but keep the
  public operation independent of UI and browser state.
- A relay returning zero events is a valid observable result, not proof of
  failure.

## Verification

- Exercise the public acquisition boundary against a deterministic temporary
  relay speaking actual NIP-01 messages and a temporary real SQLite database.
- Verify EOSE, timeout or failure distinction, event limits, invalid-event
  rejection, deduplication, provenance, and resource closure through observable
  behavior.
- Keep this as a black-box functional scenario; do not test private socket
  helpers or internal state transitions.
- During the task, attempt a bounded acquisition against multiple public relays
  and record the command and observable result in the worker report. Network
  availability is not a permanent test requirement.
- The independent reviewer should repeat a small live-relay operation when its
  environment permits and otherwise rely on the deterministic protocol
  scenario rather than inventing a network result.

## Acceptance criteria

- The CLI and library use the same acquisition and SQLite implementation.
- A successful operation stores real valid events that can be inspected with
  their relay observations.
- Partial relay failure does not discard evidence acquired from other relays.
- Timeout, EOSE, connection failure, cancellation, and limit completion remain
  distinguishable.
- Limits are enforced globally even when several relays respond concurrently.
- Invalid messages and events cannot enter memory.
- Commands terminate and owned network/database resources close.
- The reference client remains byte-for-byte unchanged.
- Permanent tests remain functional and do not freeze internal architecture.
