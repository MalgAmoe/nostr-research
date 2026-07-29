---
id: 077-deterministic-views-and-isolated-boundaries
status: ready
max_attempts: 4
validation: workflow/tasks/077-deterministic-views-and-isolated-boundaries.validate.sh
depends_on: 076-truthful-contracts-and-evidence-state
---

# Make derived views deterministic and isolate permanent external boundaries

## Context

Derived ordering currently uses `localeCompare`, and case-insensitive scanning
uses locale-sensitive lowercasing while reusing normalized-string offsets
against the original text. Results can therefore vary by host locale or ICU
version, and Unicode case expansion can produce incorrect match and excerpt
offsets.

The permanent suite also contains continuation scenarios that can reach real
DNS through `fixture.invalid`, while the public browser Worker adapter has no
direct functional boundary scenario. Several fake WebSocket fixtures duplicate
mechanics, but consolidation is useful only where it makes the tests smaller
and clearer.

## Goal

Make identical inputs produce identical derived views across supported
runtimes, keep scan evidence aligned to original text, and remove accidental
environment dependence from permanent tests.

## Work

1. Replace host-locale-dependent ordering used by collection and relation
   operations with one deterministic code-point comparison rule.
2. Apply the same deterministic rule anywhere it affects public sort order,
   min/max selection, set/move ordering, or other derived results.
3. Make case-insensitive scan matching independent of host locale.
4. Preserve match `start`, `end`, and excerpt positions against the original
   string even when Unicode case folding changes normalized code-unit length.
   Do not merely substitute `toLowerCase()` and retain invalid offsets.
5. Preserve existing substring/word, any/all, field, term, case-sensitive, and
   result-limit semantics.
6. Correct existing assertions if they pin locale-dependent behavior. Do not
   delete coverage silently.
7. Remove real DNS/network dependence from permanent continuation and
   relationship functional tests. Use deterministic in-process WebSocket
   fixtures at the public boundary.
8. Add one functional scenario for the exported browser Worker adapter covering
   initialization, one valid command/response exchange, malformed-message
   rejection, and close/lifecycle behavior. Reuse the real session engine.
9. Consolidate fake relay/WebSocket support only where multiple tests share the
   same mechanics and the result is less code. Do not create a transport test
   framework.
10. Update durable documentation only if deterministic ordering or scan-offset
    semantics are currently described differently.

## Acceptance criteria

- Collection and relation results have the same ordering independent of host
  locale and ICU collation.
- Case-insensitive scan produces the same matches across supported runtimes.
- Unicode case-expansion examples report offsets and excerpts against the
  original input correctly.
- Case-sensitive and ordinary ASCII scan behavior remains unchanged.
- Permanent tests do not depend on DNS resolution or public relay timing.
- The browser Worker public adapter has one concise boundary scenario and still
  uses the same interpreter/session implementation.
- Test support is simpler or unchanged in size; no general mocking framework is
  introduced.

## Non-goals

- Linguistic or locale-aware collation.
- Natural-language stemming, tokenization, fuzzy search, or semantic search.
- A general Unicode search library or dependency.
- Live-relay tests in the permanent suite.
- Exhaustive Worker protocol tests, browser UI tests, or private message-helper
  unit tests.
- API versioning or compatibility shims for locale-dependent ordering.

## Verification

- Permanent tests expected: yes, one focused deterministic scan/order boundary,
  extensions of existing continuation fixtures, and one browser Worker public
  boundary scenario.
- Stable public behavior protected: deterministic ordering, original-text scan
  offsets, isolated continuation outcomes, and Worker message lifecycle.
- Temporary task validation or field evidence: run the functional suite under
  at least two available locale settings if the environment supports them; the
  same seeded outputs must result.
- Explicitly excluded test levels or mechanisms: private comparator/scanner
  tests, live DNS or relays, exhaustive Unicode conformance, Playwright UI
  testing, and a standalone fake-server framework.
