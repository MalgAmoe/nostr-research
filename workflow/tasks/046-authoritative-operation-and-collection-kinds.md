---
id: 046-authoritative-operation-and-collection-kinds
status: ready
max_attempts: 5
validation: workflow/tasks/046-authoritative-operation-and-collection-kinds.validate.sh
depends_on: 045-remove-superseded-research-interfaces
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make operation semantics and collection kinds authoritative

## Objective

Remove the duplicated operation/type knowledge that caused live continuation
results to contain events or accounts while their handles remained generic
`subjects`.

Validation, execution, schema discovery, plans, and the declarative session
must consume one authoritative description of each research operation rather
than reconstructing its input/output behavior independently.

## Work

- Inventory duplicated operation lists, input-kind rules, output-kind rules,
  local/external classification, and relationship output semantics across
  memory, plans, continuation, and the interpreter.
- Concentrate that knowledge in one existing deep operation module or one
  clearly justified deep replacement; do not create a collection of shallow
  per-command modules.
- Give every continuation relationship its narrowest honest output kind:
  - account-producing relationships return `accounts`;
  - event-producing relationships return `events`;
  - only genuinely heterogeneous expansion returns `subjects`.
- Make exact `subject.type` filtering refine a generic collection to `events`
  or `accounts`; preserve generic type for predicates that cannot prove a
  homogeneous result.
- Ensure runtime collection values, preflight descriptors, handles, plans,
  templates, and schema discovery agree.
- Apply the deletion test to standalone `expansion.js` and
  `reply-contexts.js`. Move any uniquely useful protocol behavior behind
  continuation, then delete interfaces and tests that no longer earn their
  complexity. Do not preserve historical exports.
- Remove duplicated validation and result-kind switches made obsolete by the
  authoritative operation semantics.

## Required live path

The following must work without manual ID extraction:

```text
account
  -> authored-notes
  -> filter subject.type=event
  -> referencedAccounts
  -> hydrate
```

And:

```text
account
  -> followed-accounts
  -> hydrate
```

## Acceptance criteria

- No known homogeneous continuation is exposed as generic `subjects`.
- Exact subject-type filtering performs safe type refinement.
- The required paths preflight and execute through both plans and the
  persistent declarative session.
- Schema discovery reports the same kinds and routes that execution accepts.
- Operation/type knowledge is materially less duplicated.
- Superseded expansion/reply interfaces are removed unless the reviewer
  identifies specific behavior that cannot yet be expressed through the
  current research model.

## Verification

- Permanent tests expected: yes, extend one public continuation workflow to
  protect the two required paths and type refinement; retain focused protocol
  tests only for unique Nostr relationship rules.
- Stable public behavior protected: preflight/runtime kind agreement and
  composable typed navigation.
- Temporary task validation or field evidence: replay the exact live failure
  with deterministic evidence and inspect schema output.
- Explicitly excluded test levels or mechanisms: tests per relationship,
  private registry/helper tests, relay-network, socket, and UI tests.
