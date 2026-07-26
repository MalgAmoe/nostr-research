---
id: 039-scoped-working-buffers
status: done
max_attempts: 8
validation: workflow/tasks/039-scoped-working-buffers.validate.sh
depends_on: 038-jsonl-session-field-trial
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make acquisition produce bounded scoped working buffers

## Objective

Make each acquisition usable as a bounded research starting point instead of
only adding evidence to the global resident corpus.

An acquisition result must identify the exact subjects produced by that
acquisition. Later local operations must be able to explicitly choose either
that scoped buffer or the whole resident corpus.

## Work

- Represent acquisition output as an engine-owned named result using the same
  stable subject identity and current-evidence resolution as other handles.
- Keep the resident corpus canonical and shared; do not copy full records into
  command state.
- Make the default acquisition response concise:
  - requested and observed bounds;
  - distinct subjects added or refreshed;
  - duplicates and relay-level completeness;
  - corpus size, capacity pressure, and eviction effects;
  - a bounded representative preview and bounded useful facets.
- Keep detailed per-event and per-relay diagnostics available through an
  explicit bounded projection rather than returning them by default.
- Make result scope visible in summaries and errors so a caller can tell
  acquisition slice from whole-corpus query.
- Support an ergonomic replace/advance operation for a designated working
  handle without deleting its subjects from the corpus.

Do not add persistence, UI state, automatic relevance rules, or a second
memory model.

## Acceptance criteria

- A session can acquire into a named scoped buffer and subsequently select
  only from that buffer.
- Whole-corpus selection remains possible only when explicitly requested.
- Default acquisition output is bounded and does not enumerate every observed
  event.
- Detailed coverage remains inspectable on demand.
- Replacing a working handle has explicit lifecycle semantics and does not
  mutate canonical evidence.
- Existing plan and JSONL adapters use the same normalized operations.

## Verification

- Permanent tests expected: no new acquisition test. Existing public
  functional scenarios may be adapted where the changed explicit scope is
  already exercised.
- Stable public behavior protected: scoped versus corpus selection, handle
  lifecycle, bounded response envelope.
- Temporary task validation or field evidence: a bounded loopback or live
  acquisition through the real public session command, demonstrating the
  complete named-acquisition -> scoped-selection -> concise-default ->
  opt-in-coverage -> non-destructive-replacement workflow.
- Explicitly excluded test levels or mechanisms: relay-network tests,
  WebSocket/TCP/TLS behavior, private helper unit tests, UI tests.

## Reassessment after attempt 2

The original verification wording allowed a permanent deterministic
session-boundary scenario while also excluding relay-network tests. Those
requirements conflict for the public `acquire` command, which necessarily owns
relay I/O. Do not add a production acquisition-injection seam merely to make
this test deterministic.

Remove the fabricated acquisition report and direct internal presentation
assertions introduced during attempts 1-2. Verify the complete public command
chain as temporary loopback/live task evidence instead. This is a changed
verification premise, not a request to mechanically repeat the previous test
approach.

The worker sandbox could not bind the required listener. The primary agent
therefore performed this temporary verification from the outer execution
environment and recorded the result in:

`workflow/runs/039-scoped-working-buffers/manual-public-command-evidence.md`

Review this evidence instead of requesting a production test seam or another
permanent relay-network test.

## Reassessment after attempt 4

The first review after runtime evidence identified two new product defects:

1. scoped selection applied query limits to the full corpus before intersecting
   acquisition subjects, allowing unrelated corpus events to consume the
   bound and affect prefix ambiguity;
2. the concise acquisition envelope omitted bounded duplicate-observation
   counts and successful relay outcome/completeness summaries.

These findings were not repetitions of the earlier verification blocker.
Correct both at their existing plan/interpreter boundaries, add only the
smallest stable deterministic coverage warranted for scoped local selection
semantics, and rerun validation. The attempt limit was extended because the
diagnosis changed, not to retry an unchanged failure.

## Reassessment after attempt 6

The reporting corrections passed validation, but review found two new cleanup
inconsistencies: an older README paragraph still describes acquisition input
as corpus-wide, and the presentation projection duplicates the raw
added/refreshed length accounting instead of using distinct mutually exclusive
subjects. Update the stale documentation and centralize or reuse the corrected
accounting so the two public projections cannot disagree. No broader change is
authorized.
