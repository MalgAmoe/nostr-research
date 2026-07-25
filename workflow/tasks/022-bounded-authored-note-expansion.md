---
id: 022-bounded-authored-note-expansion
status: done
max_attempts: 5
validation: workflow/tasks/022-bounded-authored-note-expansion.validate.sh
depends_on: 021-concise-expansion-inspection
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Add bounded authored-note expansion

## Reason

The bookstore field trial reached an author account and profile, then naturally
needed a small sample of that account's notes to understand the creator's
actual activity. Current `author` traversal only exposes authored events
already loaded in the workspace; targeted expansion resolves an account to
kind-0 metadata but cannot explicitly acquire authored notes.

This is an evidence-backed navigation direction. It must remain deliberate and
bounded rather than becoming automatic account crawling.

## Objective

Extend the exported expansion operation with an explicit option for acquiring
a bounded recent sample of kind-1 notes authored by explicit starting account
subjects.

The exact option name may follow the established API, but usage should be
clear, for example:

```js
await research.expand(accounts, {
  relays,
  relationshipTypes: ['author'],
  direction: 'inbound',
  authoredLimit: 10,
  depth: 2,
  limit: 50,
  eventLimit: 100
})
```

## Semantics

- The option is disabled by default.
- It requires the `author` relationship and an inbound-capable direction.
- It applies only to explicit starting account subjects, not every account
  discovered later.
- It requests only kind-1 notes with a clear recent ordering assumption as
  supported by NIP-01 relay filters.
- It has an explicit positive bound and also consumes the operation-wide
  event/observation budget.
- Multiple starting accounts must not silently allow one account to exceed the
  declared per-account intention; use simple explicit requests if necessary.
- Returned notes must carry ordinary author relationship reasons and relay
  provenance.
- The session selection remains unchanged.
- Expansion reporting identifies authored-note requests and all normal bounds.

Do not generalize this into arbitrary account feeds, recommendation, following,
or background synchronization.

## Directed field trial

Use the real persistent JavaScript console to:

1. reopen the retained `nostr-bookstore-creator-commerce-seed` evidence when
   locally available, or reconstruct an equivalent disposable seed from live
   public relays;
2. select the novelist account explicitly;
3. acquire a small recent authored-note sample;
4. inspect and orient that sample;
5. expand one promising note through an existing protocol relationship if
   useful;
6. retain only worthwhile evidence; and
7. reopen the retained set.

Record exact commands, operational counts, evidence-backed findings, and API
friction in `workflow/artifacts/authored-note-expansion-field-trial.md`.
Public relay availability is field evidence, not a permanent test dependency.

## Boundaries

- No automatic authored-note acquisition for encountered accounts.
- No follows/feed generation, scoring, categorization, or interest model.
- No pagination framework or exhaustive-history claim.
- No UI, screenshots, presets, or query DSL.
- No broad session or JavaScript-interface redesign.

## Verification

Use a public functional scenario with real SQLite and local NIP-01 WebSocket
relays proving:

- the option is explicit and validated before networking;
- one and multiple account starts remain bounded as declared;
- non-starting discovered accounts are not sampled automatically;
- the global budget still governs the complete expansion;
- reasons, provenance, partial failures, and session independence survive;
- results retain and reopen; and
- default expansion behavior remains unchanged.

Run the complete suite and syntax checks.

## Acceptance criteria

- A selected account can explicitly yield a small recent authored-note sample.
- The operation remains bounded, explainable, and session-independent.
- Discovered accounts do not trigger implicit feed acquisition.
- The live trial validates whether this supports continued research.
- Existing expansion behavior remains usable.
