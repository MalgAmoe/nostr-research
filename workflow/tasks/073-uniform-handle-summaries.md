---
id: 073-uniform-handle-summaries
status: done
max_attempts: 4
validation: workflow/tasks/073-uniform-handle-summaries.validate.sh
depends_on: 072-truthful-relation-accounting
---

# Uniform factual summaries across handle kinds

## Context

`show` summary currently has different structural meanings by handle kind.
Collections, typed collections, relay reports, relations, acquisitions, and
plan reports do not share a dependable summary core. Acquisition even computes
an underlying collection summary and then drops it while wrapping the result.

Relations also distinguish rows from distinct subjects. Evidence resolution
must not count one event once per exploded row while presenting that count as
resolved subjects.

Task 072 establishes truthful relation cardinality and bound facts. This task
must consume those facts rather than reconstructing them.

## Goal

`show` with `mode: "summary"` should answer “what is in this handle?” through
one small, predictable factual core while preserving meaningful
handle-specific additions.

## Work

1. Define a compact summary core with explicit units:
   - result kind;
   - count and its unit (`subjects`, `rows`, `events`, `relays`, or `stages`);
   - evidence resolution when stable subjects can be resolved;
   - compact operation lineage;
   - completeness and bounds when applicable;
   - omissions or truncation when known.
2. Apply the same core shape to:
   - ordinary and typed collections;
   - research relations;
   - acquisition and hydration reports;
   - continuation results;
   - relay-information and relay-count reports;
   - plan reports.
3. Preserve useful existing top-level count and pagination fields. This is not
   a wholesale response redesign.
4. Count evidence resolution by distinct stable subject, not repeated row
   references. If row evidence references are useful, label that separate unit
   explicitly.
5. Add event-conditioned facts only when canonical event evidence is
   meaningfully resolvable:
   - event-kind histogram;
   - distinct author count;
   - created-at range.
   Inapplicable or unavailable facts should be absent rather than represented
   as misleading zeroes.
6. Preserve handle-specific summaries such as relay outcome categories and
   archive-level distinctions alongside the common core.
7. Keep summaries bounded and compatible with `sizeLimit`.
8. Consolidate shared presentation code only as far as needed to prevent the
   common shape from drifting. Do not create a general presentation framework.
9. Update the package reference and CLI description of summary semantics.

## Acceptance criteria

- A caller can locate result kind, count, count unit, lineage, bounds, and
  applicable completeness in the same summary location across handle kinds.
- Acquisition summary no longer drops its subject/event summary.
- Relation summary distinguishes row count from distinct subject count.
- Exploded rows backed by two events report two distinct evidence subjects,
  not one resolved subject per row.
- Event-specific facts are present only when supported by resolvable evidence.
- Relay-specific and archive-specific factual distinctions remain available.
- Summary responses remain bounded and contain no evidence preview by default.
- No recommended next operation or inferred research direction is added.

## Non-goals

- Changing relation accounting established by Task 072.
- Making preview, details, coverage, and explain structurally identical.
- Adding quality, bot, popularity, or trust classifications.
- Adding event-format rendering or a UI.
- Removing existing top-level compatibility fields merely for symmetry.

## Verification

- Permanent tests expected: yes, one public session-boundary summary contract
  exercised across representative handle families, extending an existing
  functional test where practical.
- Stable public behavior protected: common summary core, explicit units,
  distinct-subject evidence resolution, preservation of specialized facts,
  and bounded output.
- Temporary task validation or field evidence: run one sequential fixture
  session that compares collection, relation, acquisition, continuation,
  relay-report, and plan summaries.
- Explicitly excluded test levels or mechanisms: private presentation-helper
  tests, complete JSON snapshots, live-relay tests, and exhaustive testing of
  every result subtype.
