---
id: 006-query-and-navigate-memory
status: done
max_attempts: 5
validation: workflow/tasks/006-query-and-navigate-memory.validate.sh
depends_on: 005-live-relay-acquisition
protected_paths: apps/reference-client CONTEXT.md workflow/artifacts workflow/run.py workflow/prompts
---

# Query and navigate accumulated research memory

## Objective

Make acquired evidence locally searchable and navigable through the public
library and CLI while preserving provenance and explaining why results match.

All behavior operates on accumulated SQLite memory. This task must not silently
contact relays.

## Required query behavior

Support composable local constraints for:

- event IDs and ID prefixes where unambiguous;
- author public keys and prefixes where unambiguous;
- event kinds;
- inclusive creation-time bounds;
- standard Nostr tag constraints such as `#e`, `#p`, and `#t`;
- case-insensitive text terms over note content;
- explicit result limit and deterministic ordering.

Define the semantics of combining constraints and multiple text terms.
Malformed or ambiguous constraints must produce useful errors rather than
silently broadening a query.

Each returned result must include:

- the canonical event;
- stored relay observations;
- explicit match reasons derived from the submitted constraints.

The library may introduce only the derived SQLite indexes needed for these
operations. Derived data must remain rebuildable from canonical raw events.

## Required account behavior

- Resolve stored kind-0 metadata events by public key using current
  replaceable-event semantics.
- Search stored account metadata by public-key prefix and profile fields such
  as `name`, `display_name`, and `nip05`.
- Preserve the source metadata event and observations.
- Report ambiguity or absence explicitly.

Do not introduce global identity confidence or trust scoring.

## Required navigation behavior

Extract observable relationships from stored events, including:

- author;
- reply root and direct parent where NIP-10 or NIP-22 evidence identifies them;
- quoted or mentioned events;
- mentioned accounts;
- topic and other tags.

Navigate both outbound relationships from an event and inbound stored events
that reference an event or account. Return only relationships supported by
stored evidence, with relationship type and source event IDs.

Protocol interpretation must distinguish known semantics from best-effort
fallbacks. Do not infer social affinity or interest.

## CLI behavior

Extend the existing CLI with discoverable commands for:

- local event search;
- stored-account search or inspection;
- related entities for an event or account.

Structured output must retain match reasons and provenance. Commands must not
require knowledge of SQLite tables.

## Scope boundaries

- Do not add relay acquisition to local-query commands.
- Do not add ranking, recommendations, moderation, saved research sets,
  research-run persistence, graph databases, or UI integration.
- Do not expose SQL as the public query interface.
- Do not create an in-memory implementation.

## Verification

- Use reproducible signed fixtures representing metadata, replies, mentions,
  quotes, tags, multiple authors, multiple relays, and absent references.
- Verify the complete behavior through the public library or CLI and a
  temporary real SQLite database.
- A small permanent unit test is acceptable only for protocol relationship
  interpretation that is sufficiently tricky and stable to justify freezing.
- Do not test SQL text, table layout, private helpers, or module boundaries.
- The independent reviewer must construct at least one fresh black-box
  navigation scenario rather than relying only on committed fixture assertions.

## Acceptance criteria

- Local queries never contact a relay.
- Query combinations are deterministic, bounded, and documented.
- Match reasons accurately describe every returned result.
- Account metadata resolution follows Nostr replaceable-event rules.
- Relationship direction and protocol evidence are visible to callers.
- Missing referenced entities do not break navigation and remain identifiable
  as unresolved references.
- Provenance survives search and navigation.
- Derived indexes can be recreated from raw stored events.
- CLI failures are useful and non-zero.
- Reference-client behavior and source remain unchanged.
