---
id: 071-default-content-warning-exclusion
status: done
max_attempts: 4
validation: workflow/tasks/071-default-content-warning-exclusion.validate.sh
depends_on: 070-normalized-event-attachments
---

# Exclude self-warned relay events by default

## Authority

Implement Task 3 from
[`EVENT-CONTENT-ENGINE-DESIGN.md`](../../EVENT-CONTENT-ENGINE-DESIGN.md).
The warning scope, exclusion point, retained accounting, and non-goals are
settled there.

## Goal

Keep directly self-warned relay events out of the renewable observation buffer
by default while reporting exactly how many matching canonical events were
excluded.

## Required work

1. Add shared detection for any direct `content-warning` tag and for a
   self-label whose `L`/`l` namespace is `content-warning`.
2. Do not apply kind-1985 third-party labels or kind-1984 reports as hidden
   policy.
3. Add boolean acquisition configuration
   `excludeContentWarnings`, defaulting to `true`, with existing engine,
   session, and explicit-command precedence.
4. Apply exclusion after canonical validation and exact requested-filter
   matching, but before accepted-observation/distinct-event budget accounting
   and memory ingestion.
5. Excluded events must not enter memory, evict evidence, appear in acquisition
   collections, or retain identifiers, content, reasons, or attachments.
6. Add `excludedContentWarnings` to operation-wide and per-relay counts and
   expose it through bounded acquisition presentation, completeness, status
   where configuration is shown, and factual schema.
7. Propagate the option through the single acquisition implementation used by
   direct acquisition, hydration, continuation, relation-backed fetch, plans,
   sessions, JSONL, and the browser Worker.
8. Keep direct `memory.ingest()` policy-free; it remains an explicit canonical
   evidence interface.
9. Update `CONTEXT.md`, package documentation, the capability map, and next
   steps only where needed to describe implemented behavior.

## Acceptance criteria

- Default relay acquisition excludes both settled self-warning forms.
- An explicit `false` override admits those events through ordinary
  acquisition.
- Third-party label/report events are not silently trusted or followed.
- Received, invalid, non-matching, excluded, accepted, duplicate, distinct,
  and newly stored counts remain semantically distinct.
- Excluded events consume neither acquisition budget and leave no canonical
  or working-handle residue.
- Every relay-backed caller uses the same setting and implementation.

## Verification

- Extend an existing deterministic public acquisition/session scenario rather
  than creating a real TCP/TLS/WebSocket server test.
- Exercise direct warning, self-label warning, ordinary event, default
  exclusion, explicit override, counts, schema, and presentation.
- Do not add permanent live-network tests or test reason-string taxonomies.
- Run syntax checks, the functional suite, and browser smoke validation.
- After review passes, perform one bounded live-relay trial as temporary
  milestone validation.
