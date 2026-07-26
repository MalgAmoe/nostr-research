---
id: 030-acquisition-and-reactivation-correctness
status: ready
max_attempts: 5
validation: workflow/tasks/030-acquisition-and-reactivation-correctness.validate.sh
depends_on: 029-explicit-console-research-state
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Correct acquisition trust, composed budgets, and retained reactivation

## Objective

Fix four correctness gaps found by the post-refactor code review without
expanding the architecture:

1. only ingest relay events that match the exact NIP-01 filter requested;
2. count distinct events once across every nested request in one composed
   expansion or reply-context operation;
3. reject unknown direct-acquisition options; and
4. allow retained selections to become the active console selection again.

## Relay filter trust

After canonical event validation, verify that an `EVENT` received for a
subscription satisfies the normalized filter sent in its `REQ`. Use the
protocol implementation supplied by `nostr-tools` when suitable rather than
creating a partial local interpretation.

A canonical but non-matching event:

- must not be ingested;
- must not consume observation or distinct-event budgets;
- must not appear in acquired observations or additions;
- must be observable in per-relay and aggregate diagnostics/counts; and
- must not make coverage claim that it was evidence returned for the requested
  slice.

Malformed packets and invalid canonical events retain their existing distinct
reporting.

## Composed distinct-event budgets

Expansion and reply-context resolution issue several sequential relay
requests. Their distinct-event limits are operation-wide, so events already
counted by an earlier request must not consume the remaining distinct-event
allowance again.

Keep the low-level direct acquisition operation independently useful. Deepen
its existing budget implementation or otherwise centralize the accounting;
do not add a generic orchestration framework. Reports must continue to expose
per-request counts while aggregate counts describe distinct IDs across the
complete composed operation.

Add functional scenarios where a later filter first returns an event obtained
by an earlier filter and then returns a genuinely new event. The new event must
still be acquired when the operation has distinct-event capacity for it.

## Acquisition option validation

Direct acquisition must reject unknown option keys before networking. This
includes the removed `eventLimit` name. It must never silently fall back to
default limits when the caller misspells or uses an obsolete bound.

Expansion and reply-context option validation remain coherent with this rule.

## Retained-selection activation

Both the summary returned by `retain()` and the full retained selection from
`getSet()` must be accepted by the explicit console/session activation
operation. Reuse one canonical retained-selection-to-collection conversion
path for construction and later activation.

Reactivation restores subjects and retained reasons without contacting relays,
mutating canonical evidence, or claiming that evicted evidence is resident.

## Boundaries

- Do not add relay trust scores, retry policy, persistence, pagination, or
  automatic session mutation.
- Do not introduce an acquisition service, repository, adapter hierarchy, or
  generic budget framework.
- Do not restore removed runs, coverage history, or set algebra.
- Permanent tests should exercise the public acquisition, composed-operation,
  and console/session seams. Do not expose private helpers for testing.

## Documentation

Update active README and canonical context where trust validation, composed
budgets, or retained reactivation need clarification. Historical tasks and
field-trial artifacts remain historical records.

## Acceptance criteria

- Non-matching canonical relay events are rejected before ingestion and
  explicitly counted.
- Coverage and acquired collections contain only canonical matching events.
- Observation and distinct-event limits remain hard bounds.
- Expansion and reply-context distinct limits count an ID only once across all
  nested requests.
- Unknown acquisition options fail before any relay is contacted.
- A retained summary and a full retained selection can both be explicitly
  activated.
- Query, acquisition, expansion, and traversal remain stateless with respect
  to active selection.
- All functional tests and syntax checks pass, including loopback relay tests.
