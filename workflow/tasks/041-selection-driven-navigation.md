---
id: 041-selection-driven-navigation
status: done
max_attempts: 4
validation: workflow/tasks/041-selection-driven-navigation.validate.sh
depends_on: 040-composable-collection-pipelines
protected_paths: workflow/run.py workflow/prompts
reviewer_sandbox: workspace-write
---

# Let selections directly drive bounded Nostr navigation

## Objective

Allow the result of one research decision to become the input of the next
bounded local or relay operation without manually extracting and pasting
subject identifiers.

## Work

Add one typed continuation/expansion operation whose relationship determines
the traversal. It must cover the relationships already justified by the
library and field trials:

- notes authored by selected accounts;
- profile and follow-list hydration;
- followed accounts and evidence-backed followers;
- replies, ancestors, mentions, quotes, and referenced events;
- bounded conversation context;
- shared tags and linked domains;
- bounded expansion from selected notes or accounts.

The operation must accept named handles directly, derive protocol filters from
stable subject identities, respect explicit relay/time/event budgets, ingest
new evidence into the same canonical corpus, and return a new scoped handle.

Distinguish unsupported relationships, absent local evidence, partial external
resolution, and empty valid results. Preserve provenance explaining how each
result was reached.

Do not infer interests, people-versus-project identity, trust, quality, or
spam labels.

## Acceptance criteria

- An account handle can directly acquire or select its authored notes without
  caller-side ID extraction.
- A note handle can directly obtain bounded conversation and reference
  context.
- Local and external continuations share one typed command shape and clearly
  report completeness.
- Multi-subject expansion remains bounded and exposes per-input omissions.
- `explain` can show the traversal relationship responsible for membership.

## Verification

- Permanent tests expected: yes, one functional continuation scenario using
  deterministic in-memory Nostr events; protocol parsing rules may retain
  focused unit tests.
- Stable public behavior protected: typed handle input, relationship
  semantics, completeness and provenance.
- Temporary task validation or field evidence: one live account-to-authored-
  notes-to-conversation path with strict budgets.
- Explicitly excluded test levels or mechanisms: real relay tests in the
  permanent suite, socket lifecycle tests, tests per relationship.

## Reassessment after attempt 2

The completeness finding survived because local projections remained
hard-capped at the memory API's maximum query limit of 1,000. The bounded
strategy is:

- for `eventLimit < 1000`, project at `eventLimit + 1` so truncation is
  directly observable;
- at the absolute 1,000 ceiling, conservatively report the bound reached when
  the projection returns 1,000 because a 1,001st candidate cannot be queried;
- do not increase memory capacity/query limits or add another API merely to
  prove exhaustiveness.

Protect this boundary inside the existing single continuation functional
scenario. This is a clarified completeness rule, not a request to repeat the
unchanged hard-coded projection.
