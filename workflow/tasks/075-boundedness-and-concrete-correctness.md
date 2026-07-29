---
id: 075-boundedness-and-concrete-correctness
status: done
max_attempts: 4
validation: workflow/tasks/075-boundedness-and-concrete-correctness.validate.sh
depends_on:
---

# Bound observation provenance and fix concrete execution inconsistencies

## Context

The observation buffer is bounded by distinct event count, but every repeated
ingestion appends another observation to the event record. A long-lived session
can therefore grow without bound while its event count remains within capacity.
Repeated observations are legitimate provenance, so simply deduplicating by
relay would destroy information.

Three other verified execution inconsistencies are independent but similarly
narrow:

- planning refines `subject.type in ["event"]` to an events collection while
  execution only refines `equals`, allowing incoherently typed outputs;
- a chained divide expression can turn divide-by-zero `null` into numeric zero;
- acquisition does not guard a synchronous WebSocket `send()` failure although
  the relay-count transport does.

The permanent crypto boundary also lacks a well-formed but incorrect signature
case.

## Goal

Keep memory genuinely bounded and make these established operations execute
according to their existing contracts without introducing new research
semantics.

## Work

1. Add an engine-owned maximum of 100 retained observations per canonical event.
   Publish it as a factual memory constraint through the existing global
   constraint/schema surface.
2. Deduplicate genuinely identical observations while they are retained.
   Observations from the same relay at different observed times remain distinct
   facts.
3. Once the per-event bound is reached, discard further observation objects and
   increment a count of discarded observation attempts. The count is not a
   count of distinct unseen facts: exact deduplication of an unbounded discarded
   stream would itself require unbounded memory. Do not retain a second cache,
   rolling identity set, or probabilistic structure for omitted observations.
   Surface the boundedness and omission semantics wherever event provenance or
   memory/corpus facts make them relevant.
4. Preserve the observation omission fact through buffer snapshots,
   transactions, canonical archive preservation, resolution, and presentation.
5. Use one authoritative collection-kind refinement rule for both validation/
   planning and execution. A single-value `in` predicate over `subject.type`
   must behave like its equivalent `equals` predicate.
6. Make division null-preserving across the whole chain. Division by zero or a
   prior null result must yield null, never recover into a number.
7. Guard the acquisition WebSocket `send()` call. A synchronous failure must
   settle that relay attempt with an attributed peer/transport outcome rather
   than escape the listener or become a timeout.
8. Add one protocol-level case using a structurally valid but cryptographically
   incorrect Schnorr signature.
9. Keep Node and browser consumers on the same execution paths.

## Acceptance criteria

- At most 100 observation objects are retained for one event regardless of how
  many times it is ingested.
- Repeated but distinct observations remain provenance until the bound is
  reached; identical retained observations do not consume additional slots.
- Omitted observation-attempt count is machine-readable, is not described as
  distinct omitted evidence, and survives transaction and archive paths.
- `subject.type equals "event"` and `subject.type in ["event"]` produce the same
  typed collection and compatible movement routes.
- Divide-by-zero remains null through subsequent divide operands.
- A synchronous acquisition `send()` failure is reported and cannot crash or
  hang the session.
- A canonical-looking event with the wrong valid-length signature is rejected.
- No trust, ranking, navigation, or vessel behavior is added.

## Non-goals

- Retaining an unbounded observation timeline.
- Exact deduplication or approximate membership tracking for discarded
  observations.
- Per-relay observation quotas, sampling policies, persistence, or byte-weighted
  memory accounting.
- Changing the distinct-event buffer capacity or acquisition budgets.
- A transport testing framework or new WebSocket abstraction.
- Unit tests for private collection, relation, or transport helpers.

## Verification

- Permanent tests expected: yes, by extending existing public memory/session,
  relation, acquisition, and protocol functional scenarios where practical.
- Stable public behavior protected: bounded provenance with visible omissions,
  typed collection refinement, derive null semantics, attributed send failure,
  and signature verification.
- Temporary task validation or field evidence: deterministic repeated ingestion
  and fake-WebSocket send failure; no DNS or public relay.
- Explicitly excluded test levels or mechanisms: one test file per fix, private
  helper imports, live relays, TCP servers, timing benchmarks, and exhaustive
  transport simulation.
