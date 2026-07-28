---
id: 065-preserve-direct-field-lineage
status: done
max_attempts: 4
validation: workflow/tasks/065-preserve-direct-field-lineage.validate.sh
depends_on: 064-remove-verified-dead-code
---

# Preserve identity lineage through direct derive aliases

## Confirmed gap and decision

Relation `derive` currently leaves field definitions unchanged. A newly
derived field therefore has no lineage even when its expression is exactly a
reference to a source field with known account, event, or address identity.
The later `extract` transition cannot discover that factual identity.

Lineage is navigation metadata, not a value inference or general type system.
The selected rule is deliberately strict:

- a bare field-reference expression inherits the referenced field's lineage
  and `subjectType`;
- every computed expression, including constants, concatenation, arithmetic,
  conditionals, and `coalesce`, does not inherit identity metadata; and
- strings must never be inspected to guess whether they resemble a public key,
  event ID, or address.

## Goal

Allow a direct field alias created by `derive` to remain navigable while
keeping computed values semantically untyped.

## Required work

1. Extend derive field-definition transformation using the existing expression
   representation and field-definition machinery.
2. For a bare field reference, record lineage through the referenced source
   field and propagate its known `subjectType`.
3. Leave computed derived fields without inherited identity metadata.
4. Ensure contextual schema and relation subject transitions reflect the
   resulting factual field definitions without adding suggested next actions.
5. Preserve relation rows, expression evaluation, provenance, and every
   non-derive transformation.
6. Update the durable field-lineage documentation only if necessary to state
   the strict direct-reference boundary.

## Acceptance criteria

- Deriving an alias directly from a typed source field allows the established
  extraction transition for that alias.
- Deriving a constant or computed value does not create an extraction
  transition merely because its output resembles an identity.
- Existing project, aggregate, explode, join, scan, and other derive behavior
  remains unchanged.
- No expression framework, static type system, string sniffing, or automatic
  research workflow is introduced.

## Verification

- Permanent tests expected: yes, by extending an existing public-boundary
  relation/navigation scenario.
- Stable public behavior protected: direct-alias lineage survives and computed
  values remain untyped.
- Temporary task validation: syntax checks and the complete functional suite.
- Explicitly excluded: private transformation-helper tests, exhaustive
  expression grammar tests, schema snapshots, and inferred identity parsing.
