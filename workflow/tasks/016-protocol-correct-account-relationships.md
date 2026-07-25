---
id: 016-protocol-correct-account-relationships
status: done
max_attempts: 5
validation: workflow/tasks/016-protocol-correct-account-relationships.validate.sh
depends_on: 015-console-research-field-trial
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Make account relationships and replaceable events protocol-correct

## Reason

The first persistent-console investigations exposed a concrete semantic error:
the library currently interprets every `p` tag as an account mention. A `p`
tag in a kind-3 contact list is follow evidence, not an ordinary mention.
Research traversal therefore works mechanically but can explain the
relationship incorrectly.

The same investigations also encountered multiple historical kind-3 events
when ordinary research wanted the current contact list. Raw historical
evidence must remain preserved while the semantic view selects the current
replaceable event correctly.

## Objective

Separate raw Nostr tag evidence from its event-kind interpretation and provide
one cohesive current-event operation for replaceable protocol records.

## Relationship interpretation

- Continue preserving canonical events and their raw tags unchanged.
- Interpret kind-1 and other ordinary-event `p` tags as mentioned accounts
  where that meaning is valid.
- Interpret kind-3 `p` tags as followed accounts.
- Expose an explicit `follow` relationship type in navigation and explanation.
- A follow explanation must identify the source kind-3 event and exact `p`
  tag. It is evidence that the contact-list event named an account, not a
  claim of trust, endorsement, identity, or current social closeness.
- Do not preserve the incorrect `mentioned-account` interpretation for kind-3
  evidence solely for experimental compatibility.

Existing stored canonical events may be reinterpreted or their derived
relationship rows rebuilt. There is no legacy experimental database contract
to preserve, but canonical evidence and observations must not be discarded.

## Current replaceable events

Provide one small public operation that selects the current stored event using
NIP-01 semantics for:

- kinds 0 and 3;
- replaceable kinds in the 10000–19999 range, including kind 10002; and
- parameterized replaceable kinds in the 30000–39999 range using the `d` tag.

Use the protocol timestamp and event-ID tie-break rules consistently. Historical
events remain directly inspectable as evidence.

The operation should be reusable by profile metadata, follow navigation, relay
list interpretation, and later protocol-specific views rather than duplicating
current-event selection in each feature.

## Direct follow navigation

Expose a direct UI-independent operation usable from the console:

```js
const followed = research.follows(account)
```

It must:

- resolve the account through existing subject rules;
- use its current stored kind-3 event;
- return followed accounts as a shared result collection;
- preserve unresolved followed public keys as navigable account subjects;
- retain exact event/tag reasons and observation provenance; and
- return an empty explainable result when no current contact list is stored.

It must not acquire relays automatically or imply reciprocity.

## Boundaries

- No recommendation, trust, popularity, spam, or interestingness scores.
- No general NIP framework or event-class hierarchy.
- No UI, default relays, background acquisition, or graph visualization.
- Do not create a second relationship engine beside the existing one.
- Do not add backward-compatibility branches for incorrect experimental
  derived rows.

## Documentation

Document raw evidence versus interpreted relationship, historical versus
current replaceable events, and follow evidence versus endorsement.

## Verification

Use a small protocol-focused public functional scenario containing:

- historical and current kind-3 events for one account;
- a kind-1 mention using the same `p` tag vocabulary;
- equal-timestamp replaceable events that exercise the event-ID tie-break;
- kind-10002 and parameterized-replaceable examples;
- follow traversal with resolved and unresolved accounts; and
- close/reopen verification proving canonical history remains present while
  the semantic view remains stable.

Drive public library and console-facing operations. Do not test private SQL or
tag helpers individually.

## Acceptance criteria

- Kind-3 `p` tags are explained as follows, not mentions.
- Ordinary mentions keep their correct meaning.
- Current replaceable selection follows NIP-01 semantics.
- Raw historical canonical evidence remains available.
- `research.follows(account)` returns a composable, provenance-preserving
  result collection.
- Existing search, traversal, sessions, retention, and CLI behavior remain
  usable.
