---
id: 076-truthful-contracts-and-evidence-state
status: done
max_attempts: 4
validation: workflow/tasks/076-truthful-contracts-and-evidence-state.validate.sh
depends_on: 075-boundedness-and-concrete-correctness
---

# Align public constraints, errors, evidence residency, and bounded reporting

## Context

Several verified seams currently expose facts differently depending on the
entry path:

- session configuration enforces acquisition timeout and concurrency maxima,
  while direct acquire/hydrate/fetch/relay-continuation overrides accept larger
  values and the operation contract omits those maxima;
- semantic failures are partly classified by regex-matching exception prose, so
  full stores, unresolved preservation, and unknown memberships receive
  misleading codes;
- rebuilding canonical archive indexes can replace rather than merge two
  archive entries that resolve to the same event;
- archive-preferred resolution makes `inspect.resident` false even when the
  event remains in the observation buffer;
- extract can ignore known field lineage and silently return invalid values for
  a contradictory requested subject type;
- plans have no stage-count bound and failed plans do not expose already-sent
  external attempts;
- generic response-size fallback can describe omissions on the wrong axis for
  non-preview observations such as acquisition coverage.

These are contract and evidence-state issues. They do not justify a new error
framework, plan report model, or presentation architecture.

## Goal

Make caller-visible constraints and evidence facts precise enough for the
future navigator wrapper to rely on without parsing prose or guessing which
entry path was used.

## Work

1. Treat the existing acquisition timeout maximum of 60,000 ms and concurrency
   maximum of 10 as authoritative for every external path using acquisition
   controls: acquire, hydrate, fetch, and relay-backed continuation.
2. Publish those maxima through the shared operation contract facts. Do not
   invent maxima for observation or distinct-event budgets where the canonical
   constraints currently define none.
3. Ensure one normalization rule owns these supported ranges rather than
   duplicating checks between command paths.
4. Add a minimal explicit semantic error mechanism at throw sites. Support:
   - `CAPACITY_EXCEEDED` for archive and notebook capacity exhaustion;
   - `UNKNOWN_MEMBERSHIP` for an absent named membership;
   - `UNRESOLVED_EVIDENCE` for preservation or operations requiring evidence
     the corpus cannot resolve.
   Preserve existing codes where already correct. Do not create a class
   hierarchy or replace the response envelope.
5. Rebuild canonical archive evidence by event ID while merging unique
   observation snapshots from every canonical archive alias.
6. Compute buffer residency independently from preferred resolution source.
   `resident` means present in the renewable buffer; `resolutionSource` may
   still be `archive`.
7. During extract, reject a requested subject type only when the field's known
   lineage contradicts it. Continue allowing caller-declared types for fields
   with no subject lineage.
8. Introduce a documented, schema-visible maximum of 100 stages per plan.
9. Document that plan memory changes roll back on failure but external requests
   already sent cannot be undone and their successful reports are not returned
   from a failed plan. Do not build a rolled-back-stage report yet.
10. Give coverage and other non-preview observation modes an
    observation-appropriate compact fallback. Preserve typed omission axes such
    as omitted relays, observed events, outcomes, and stages rather than
    synthesizing generic event-count omissions.
11. Update CLI/package documentation only where these caller-visible contracts
    change.

## Acceptance criteria

- Configuration, direct commands, plans, JSONL, and browser Worker agree on
  acquisition timeout and concurrency ranges.
- Contextual/global schema publishes the maxima actually enforced.
- Capacity exhaustion, unknown membership, and unresolved evidence have stable
  machine-readable semantic codes without message matching.
- Two canonical archive aliases for one event preserve the union of their
  observations.
- Inspection can truthfully report both `resident: true` and
  `resolutionSource: "archive"`.
- Known lineage contradictions fail before producing a misleading empty
  extraction; unmarked generic fields remain extractable.
- Plans reject more than 100 stages and documentation describes the external
  contact limitation without promising rollback of the network.
- Size-bounded coverage never reports relay omission using event cardinality.
- No new workflow, recommendation, retry, or plan-report subsystem is added.

## Non-goals

- New acquisition budget maxima beyond canonical constraints.
- A general typed exception hierarchy.
- Returning completed external stage reports from failed plans.
- Transactional network contact.
- Redesigning `inspect`, archive levels, extraction, or presentation modes.
- Adding automatic retry, fallback, relay scheduling, or vessel controls.

## Verification

- Permanent tests expected: yes, by extending a small number of public session
  and memory-boundary scenarios for the corrected contracts.
- Stable public behavior protected: shared acquisition maxima, semantic error
  codes, archive observation union, independent residency, lineage-aware
  extraction, plan bounds, and typed coverage omissions.
- Temporary task validation or field evidence: one JSONL scenario exercising
  representative error envelopes and aggressively size-bounded coverage.
- Explicitly excluded test levels or mechanisms: tests of regex/error helpers,
  private archive indexes, complete response snapshots, live relays, one test
  per throw site, and a failed-plan report feature.
