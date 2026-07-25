# Open questions affecting the later library boundary

These are deliberately narrow. Source and tests establish the current
implementation; they cannot establish which of its heuristics or omissions the
later library should preserve. Product items therefore require human judgment
and should not be answered by copying the current client.

## Factual questions answerable from repository evidence (or its absence)

None remain. The repository establishes, for example, that `readEvents`
returns events without per-relay states (`src/nostr-runtime.js`), NIP-11
processing reads only `document.limitation.max_limit`
(`src/relay-info.js`, `src/relay-planner.js`), only keyword-search relays are
editable (`src/app.jsx`), and `keys/dev-user.json` is generated/served as a
development artifact rather than imported by product code
(`scripts/generate-keys.mjs`, `server.mjs`). Those facts do not establish
whether a later library should retain them.

## Product decisions requiring human judgment

1. **What reliability contract should a multi-relay read offer?** The current
   `queryRelay` exposes per-relay states while `readEvents` returns only
   deduplicated events and provenance (`src/nostr-runtime.js`). Decide whether
   later callers need partial-result states, cancellation, retries, and an
   explicit completion/error contract.

2. **What NIP-11 metadata contract should relay planning honor?** The client
   reads unvalidated `document.limitation.max_limit` and ignores all other
   metadata for planning (`src/relay-info.js`, `src/relay-planner.js`). Decide
   which metadata fields, validation, caching, and failure behavior are part of
   the library rather than adopting this narrow implementation accidentally.

3. **Which account-search heuristics, if any, belong in the library?** Plain
   name search truncates to five characters and permits edit-distance-one
   matching after client-side profile verification
   (`src/research-session.js`, `src/research-session.test.js`). Decide the
   recall/false-positive trade-off and whether this is caller policy instead.

4. **What is the library’s trust boundary?** Should it verify event IDs,
   signatures, NIP-05 claims, NIP-51 imports, and deletion authorization—or
   intentionally accept already-obtained event objects as the client does?
   This materially changes dependencies, error semantics, and security claims.

5. **What provenance model must survive across stores and clients?** The
   current model records a union of relay URLs per event and allows an event
   through a muted relay rule if any allowed source exists. Decide whether
   provenance needs timestamps, per-query/filter context, raw relay outcomes,
   or immutable evidence records.

6. **Should moderation be in the library at all, and at what level?** Decide
   whether account/topic/word/event/relay rules are caller policy, whether
   destructive archive deletion is allowed, and whether name-based rules are
   supported despite metadata timing and false-positive risks.

7. **What guarantees should corpus operations make?** Choose semantics for
   partial relay failure, ordering, dedupe (ID versus content), pagination
   completeness, intersection after pagination, and whether presentation
   filters must remain strictly separate from retrieval filters.

8. **Which protocol interpretations should be normative versus optional
   heuristics?** In particular: unmarked NIP-10 inference, broad kind-class
   classification, lifecycle display after a deletion request, relation tag
   handling, and NIP-65 relay selection preference.

9. **Are Relay Explorer and pulse scores library behavior or product
   experimentation?** Direction limits, time/depth caps, kinds, noise labels,
   account/topic scoring, vocabulary stopwords, and “skeptical” plans embed
   editorial decisions. Decide whether to retain them, expose parameterized
   analysis primitives, or omit them.

10. **What portability formats deserve long-term compatibility?** Decide
   whether mute draft and research manifest/package JSON formats are supported
   interchange contracts, versioned exports only, or disposable UI artifacts;
   the current fingerprint is not an integrity mechanism.

11. **Which persistence adapters are in scope?** The current functionality
   assumes localStorage + IndexedDB and a loopback Node log server. Decide
   whether the later library must work in Node, workers, SSR, React Native, or
   multiple browser tabs, and what storage/error contract applies.

12. **Is local usage telemetry a product requirement?** If retained, decide
   event schema, consent/redaction, retention/rotation, transport ownership,
   and whether query terms or event IDs may be recorded. The present endpoint
   is best-effort and schema-free.

13. **Should archive writes be atomic and repairable?** The current
    `storeEvents` implementation uses separate transactions for event and
    search-index records, with no repair path (`src/research-store.js`). Decide
    the atomicity, migration, and multi-tab consistency guarantee for any
    persistence adapter.

14. **Which relay roles should be configurable?** General and indexer relay
    lists are fixed in `src/app.jsx`, while only keyword-search relays are
    editable despite older README wording. Decide the supported configuration
    model rather than treating the present split as authoritative.

15. **Should a development identity exist in the packaged reference or
    library distribution?** `keys/dev-user.json` is generated by
    `scripts/generate-keys.mjs`, blocked by `server.mjs`, and unused by product
    imports. Retaining, generating, or removing it is a packaging/security
    decision, not an unresolved implementation fact.
