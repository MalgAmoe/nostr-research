---
id: 019-bounded-targeted-expansion
status: ready
max_attempts: 5
validation: workflow/tasks/019-bounded-targeted-expansion.validate.sh
depends_on: 018-bounded-inspection-and-orientation
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded targeted expansion

## Reason

Two live console investigations found useful seeds and then repeatedly required
the caller to inspect tags, copy unresolved event IDs and public keys, construct
separate relay filters for quoted events, replies, and profiles, acquire them,
reload the workspace, and traverse again. Existing acquisition and traversal
are individually sound, but this mechanical gap makes directed navigation
harder than it needs to be.

The workspace already represents a bounded disposable working corpus over
durable SQLite memory. Do not introduce a second buffer, path, frontier,
preference, or vessel abstraction.

## Objective

Expose one explicit asynchronous console operation:

```js
const expanded = await research.expand(selection, {
  relays: ['wss://relay.example/'],
  relationshipTypes: [
    'quoted-event',
    'reply-parent',
    'reply-root',
    'mentioned-account',
    'author'
  ],
  direction: 'both',
  depth: 2,
  limit: 100,
  timeoutMs: 10_000,
  eventLimit: 200,
  concurrency: 3
})
```

`selection` is an explicit shared result value. Expansion must not depend on or
mutate session selection.

## Behavior

Expansion composes the existing workspace traversal and relay acquisition:

1. traverse the supplied selection using the requested relationship semantics;
2. identify unresolved event and account targets;
3. issue the minimum practical NIP-01 filters for missing event IDs and kind-0
   account metadata;
4. when inbound reply relationships are requested, query `#e` for selected or
   reached event IDs;
5. hydrate acquired evidence into the existing workspace;
6. repeat only as needed to satisfy the requested depth; and
7. return one ordinary bounded result collection from the final traversal.

Use one operation-wide event/observation budget, timeout policy, and explicit
relay list. Never crawl in the background, silently retry indefinitely, or
claim exhaustive coverage. Deduplicate targets and filters. Stop when the
budget, depth, or lack of new targets ends the operation.

The result context must make the operation understandable without retaining
complete acquisition objects. Report at least:

- exact expansion options and starting subjects;
- workspace capacity/usage before and after;
- request/filter count;
- observations, newly stored events, duplicates, and invalid events;
- relay outcomes and diagnostics per request;
- unresolved targets before and after; and
- whether depth, traversal limit, event budget, or timeout bounded the result.

Preserve ordinary item reasons and provenance. Every discovered item must
remain explainable through traversal relationships. Complete acquisition
coverage remains available through the existing durable coverage records.

If the existing `research.summary()` does not already make memory size,
workspace usage/capacity, and current selection size obvious, improve its
labels minimally. Do not add a monitoring subsystem or duplicate the workspace
description.

## API and validation

Reject unknown options, unsupported relationship types, empty relay lists, and
invalid budgets before networking. Cancellation must propagate through the
whole expansion and release owned sockets. Partial relay failure should return
the useful evidence obtained from other relays with explicit diagnostics.

Keep orchestration cohesive in the console/research-environment layer unless a
small public library operation clearly reduces duplication. Do not move relay
policy into sessions or durable memory.

## Boundaries

- No automatic interestingness, spam, trust, or recommendation score.
- No marks, preferences, path persistence, buffer class, or fluent query DSL.
- No default relays, background acquisition, unbounded crawling, or automatic
  mutation of session selection.
- No new storage abstraction or database schema merely for expansion.
- Do not add unit tests for private filter-building helpers.

## Verification

Add one public functional scenario using real SQLite and local NIP-01 WebSocket
relays. Starting from a stored seed, it must prove that a single expansion:

- fetches a missing quoted event and its profile;
- fetches an inbound reply when requested;
- expands a second hop within the global budget;
- survives one partial relay failure;
- returns relationship reasons and relay provenance;
- reports capacity and acquisition pressure;
- leaves session selection unchanged;
- remains bounded; and
- can be retained and reopened from SQLite.

Also run the full existing suite and syntax checks. Live public relay behavior
is a field validation, not a permanent network-dependent test.

## Acceptance criteria

- A directed seed can become a bounded locally expanded evidence collection
  without manually copying IDs into several acquisition calls.
- Expansion is explicit, composable, explainable, and session-independent.
- One global budget governs the complete multi-request operation.
- Workspace pressure and partial relay outcomes are observable.
- Existing acquisition, traversal, retention, console, and session behavior
  remain intact.
