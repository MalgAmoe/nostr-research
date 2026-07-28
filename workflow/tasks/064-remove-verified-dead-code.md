---
id: 064-remove-verified-dead-code
status: done
max_attempts: 4
validation: workflow/tasks/064-remove-verified-dead-code.validate.sh
depends_on: 063-honest-continuation-and-normalization
---

# Remove verified dead implementation paths

## Confirmed dead code

Repository-wide usage checks found these definitions have no callers:

- `IndexedObservationBuffer.candidateIds`;
- `normalizeProjectionLimit`; and
- `isPublicResearchSet`.

The command dispatcher also rejects every unexpected input handle before the
`memberships` and `membership` branches, making the repeated input checks
inside those branches unreachable.

## Goal

Delete code that does not participate in the current product without
reorganizing working responsibilities or preserving speculative machinery.

## Required work

1. Remove the three unused definitions listed above.
2. Remove the two unreachable repeated input checks from the interpreter.
3. Remove imports or comments made unused solely by those deletions.
4. Do not remove the observation-buffer indexes that still support
   relationship derivation or factual status/description output.
5. Do not replace deleted code with abstractions, compatibility aliases, or
   speculative optimized selection paths.

## Acceptance criteria

- The confirmed unused definitions and unreachable branches are absent.
- Public exports, operation behavior, result shapes, schema, and documentation
  remain unchanged.
- The change is substantially deletion-only.

## Verification

- Permanent tests expected: no.
- Stable public behavior protected: the existing complete functional suite.
- Temporary task validation: syntax checks, the functional suite, and a source
  search confirming the named dead definitions are absent.
- Explicitly excluded: performance optimization, index redesign, module
  splitting, and new tests for private implementation details.
