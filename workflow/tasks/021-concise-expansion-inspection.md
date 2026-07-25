---
id: 021-concise-expansion-inspection
status: done
max_attempts: 4
validation: workflow/tasks/021-concise-expansion-inspection.validate.sh
depends_on: 020-correct-reusable-expansion
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make expansion inspection concise

## Reason

`research.show(expanded)` currently compacts traversal relationships but
retains the complete expansion report, including every generated filter and
per-relay response. Real investigations showed that this overwhelms the useful
result preview and can approach the presentation size guard.

Complete diagnostics are valuable and must remain available on the original
collection. Normal inspection needs an instrument panel rather than a network
trace.

## Objective

When a result collection contains `context.expansion`, make
`research.show(collection)` present a compact expansion summary containing:

- starting and resulting subject counts;
- request/filter count;
- observations, newly stored, duplicate, and invalid counts;
- workspace event usage and capacity before and after;
- unresolved event/account counts before and after;
- completion reason;
- depth, traversal-limit, event-budget, timeout, and cancellation bounds; and
- concise partial relay failures with relay and diagnostic.

Do not include successful per-relay responses, complete generated filters, or
complete request objects in the ordinary shown context. Preserve them,
unchanged, on the original `collection.context.expansion.requests`.

The summary must remain meaningful when the overall presentation size limit is
small. It should not require callers to guess internal properties merely to
understand whether expansion succeeded or was bounded.

## Boundaries

- No changes to expansion acquisition behavior.
- No new logging, monitoring, telemetry, or persistence.
- No generic presentation framework.
- No authored-note expansion.
- Do not remove access to complete diagnostics.

## Verification

Use a public inspection scenario with a synthetic expanded collection
containing many requests and relay diagnostics. Prove that:

- shown output stays within the configured size bound;
- the compact dashboard retains all required operational signals;
- partial failures remain visible;
- successful relay response detail and raw filters are omitted from shown
  output; and
- the original collection remains complete and unchanged.

Run the complete suite and syntax checks.

## Acceptance criteria

- Expansion inspection is concise enough for routine console use.
- Capacity, acquisition pressure, uncertainty, and failures remain visible.
- Complete diagnostics remain available without dominating `show`.
- Existing presentation of non-expansion collections remains stable.
