# Capability inventory — reference client

This is a behavioral inventory of the current reference application, not a
recommendation for the later library design. “Assessment” says whether a
behavior looks like a candidate for extraction, needs a clean re-creation,
is application/UI coordination, or is questionable/obsolete. A module being
small or tested is not, by itself, evidence that it is a desired boundary.

## 1. Relay collection and provenance

### 1.1 Bounded relay querying with moderation, timeout states, and provenance

- **Caller-visible behavior:** Given Nostr filters and relay URLs, retrieves
  events relay-by-relay, returns a deduplicated combined result for multi-relay
  reads, and exposes whether an individual relay was `ok`, `muted`, `timeout`,
  or `error`. Callers can ask which relays supplied an event.
- **Inputs / outputs:** `queryRelay(relay, filter, label, { maxWaitMs })` and
  `readEvents(filter, label, relays)` accept Nostr filters; query results are
  arrays with a non-enumerable `queryState` for a direct relay query. Runtime
  exposes `sourcesFor`, `recordSources`, `removeSources`, `clearCache`, and
  `destroy`.
- **Protocol semantics / limits:** Uses `nostr-tools` `SimplePool.querySync`.
  Default direct-query wait is 4.5 seconds plus a 250 ms guard race. A relay
  denied by moderation is not contacted. `readEvents` coalesces concurrent
  identical reads and maintains a 60-second, maximum-200-entry in-memory
  cache. Events require an `id` for deduplication/provenance. Per-relay
  response status is not retained by `readEvents`; callers that need it must
  issue `queryRelay` calls.
- **State / persistence:** Module-local `cache` and `sources` maps; accepted
  events are asynchronously handed to injected persistence. Source lists
  accumulate in memory, rather than replacing prior sources.
- **Locations:** `src/nostr-runtime.js:createNostrRuntime`; application wiring
  and global policy gate in `src/app.jsx:66-76`.
- **Current test coverage:** `src/correctness-boundaries.test.js` verifies
  timeout versus successful empty responses and source merging; no tests cover
  cache expiry, eviction, error state, or actual `SimplePool` integration.
- **Assessment:** **Recreate cleanly.** The behavior is central, but it mixes
  transport, cache, policy callbacks, persistence side effects, telemetry, and
  an array metadata convention.
- **Uncertainties / contradictions:** README calls reads “bounded short-lived
  caching,” but `queryRelay` itself has no cache. A timed-out pool operation is
  not explicitly cancelled; destroying the pool later is the only cleanup.

### 1.2 Relay metadata and query planning

- **Caller-visible behavior:** Fetches relay information documents, derives
  read/write relay lists from kind `10002` events, ranks explicit hints ahead
  of advertised and fallback relays, and caps a requested filter limit when a
  relay advertises `limitation.max_limit`.
- **Inputs / outputs:** `loadRelayInformation(relay)` and
  `loadRelayInformationSet(relays)`, plus `relayListFromEvent`,
  `planEntityRelays`, and `relayQueryLimit`, return relay metadata/maps,
  normalized relay plans, or numeric limits.
- **Protocol semantics / limits:** Converts `wss:`/`ws:` to HTTP(S) for NIP-11
  metadata and requests `application/nostr+json`; 3.5-second timeout. NIP-65
  `r` tags without a marker enter both read and write lists; "mentions" uses
  advertised read relays, other purposes use write relays. URLs must be
  `ws:`/`wss:` and are normalized; plans default to at most six relays.
- **State / persistence:** `src/relay-info.js` keeps an unbounded module-global
  promise cache by original relay string. Application keeps accumulated relay
  information in a Solid signal only for the active page session.
- **Locations:** `src/relay-info.js`, `src/relay-planner.js`, and account/event
  route loading plus query limit application in `src/app.jsx:231-377` and
  `src/research-session.js:214-247`.
- **Current test coverage:** `src/relay-planner.test.js` covers marker parsing,
  priority, normalization, and max-limit clipping. No tests cover NIP-11 HTTP
  retrieval or metadata cache behavior.
- **Assessment:** Planner functions appear **suitable for extraction** after
  specification review; NIP-11 fetching should be **recreated cleanly** to
  make cache and failure policy explicit.
- **Uncertainties / contradictions:** Relay information accepts a documented
  field named `limitation`, but no validation is performed. The app’s primary
  general relay set is fixed while the README says the default search relay set
  is editable—only keyword-search relays are editable.

## 2. Search, resolution, and corpus operations

### 2.1 Search request construction and structured constraints

- **Caller-visible behavior:** Normalizes a mutable draft into a bounded,
  trimmed request; shows which constraints are relay-side versus local;
  compiles it into a relay plan; and turns current-corpus facets into a new
  search draft.
- **Inputs / outputs:** `createResearchDraft`, `createSearchRequest`,
  `searchRequestProblem`, `compileRelayPlan`, `researchPatchFromFacets`,
  `constraintChips`, `removeConstraint`, and `applyLocalConstraints` use text,
  mode, operation, limits, and author/kind/tag/date/domain/media/relay fields.
- **Protocol semantics / limits:** Modes are topic/person/note/words;
  operations are replace/union/intersect; requested limit is clamped to
  10–1000. Relay filters support `authors`, `kinds`, one-character tag filters,
  `since`/`until`, IDs, and NIP-50 `search`. Domain and media never become
  relay filters. Intersections preserve a snapshot of base IDs. Local topic
  matching permits either a `t` tag or substring in content for
  `promotedTopic`.
- **State / persistence:** Pure except for time defaults; session owns the
  draft and plan.
- **Locations:** `src/query-spec.js`; orchestration in
  `src/research-session.js:80-374` and composer UI in `src/app.jsx:786-800`.
- **Current test coverage:** `src/query-spec.test.js` covers normalization,
  validation, compile behavior, facet transition, chips, and local filtering.
- **Assessment:** **Suitable for extraction** as behavior, but the later
  interface should not inherit the current draft shape without review.
- **Uncertainties / contradictions:** A date facet becomes a UTC day whereas
  presentation dates also use UTC; this is consistent but undocumented to a
  caller. `promotedTopic` has looser local semantics than a `#t` relay filter.

### 2.2 Multi-mode entity and account resolution

- **Caller-visible behavior:** Resolves topic, keywords, profiles, accounts,
  events, NIP-05 identities, and NIP-19 values into relay filters. Direct
  routes can resolve event IDs, addressable event addresses, accounts, and
  follows pages; fetched account data includes metadata, relay list, authored
  events, inbound mentions, and follow tags.
- **Inputs / outputs:** Session `resolvePubkey`/`startRelaySearch`; application
  hash routes `#/topic`, `#/event`, `#/raw`, `#/address`, `#/account`, and
  `#/follows`. Outputs are a session corpus or route data object.
- **Protocol semantics / limits:** Supports hex pubkeys/event IDs, `npub`,
  `nprofile`, `note`, `nevent`, and `naddr`; embedded NIP-19 relay hints are
  preferred when available. NIP-05 uses `https://domain/.well-known/nostr.json`.
  Plain person names query kind 0 through keyword relays (first five
  characters if longer than five), then client-verifies profile values and
  allows edit-distance-one identity matching. Event routes query reply/comment
  tags and report/label kinds 1984/1985; account routes obtain kind 10002
  relay lists and latest kind 3 follows.
- **State / persistence:** Discovered event records live in the application’s
  `knownEvents` map; profiles live in a Solid signal and may be hydrated in
  batches (first 100 authors, then 500-sized indexer batches for name rules).
  Retrieved events are persisted through the runtime.
- **Locations:** `src/research-session.js:151-202`; route resolution and
  profile hydration in `src/app.jsx:278-377`; relay selection in
  `src/relay-planner.js`.
- **Current test coverage:** `src/research-session.test.js` covers plain-name
  profile query/filtering and keyword result verification. There are no tests
  for NIP-05, NIP-19 decoding, routes, NIP-65-driven account reads, or profile
  batching.
- **Assessment:** Protocol decoding and filter derivation should be
  **recreated cleanly**; routing, profile cache, DOM focus, and route fallback
  policy are **UI/application coordination**.
- **Uncertainties / contradictions:** NIP-05 responses are not validated for
  status, JSON shape, name normalization, or key validity. The fuzzy profile
  rule may produce false positives; it is an application heuristic, not a
  protocol guarantee.

### 2.3 Corpus set operations, pagination, and presentation filters

- **Caller-visible behavior:** Replaces, unions, or intersects results;
  retrieves older pages; presents a fixed retrieved corpus through type, age,
  facet, relay, media, and optional display-deduplication filters.
- **Inputs / outputs:** `mergeSearchResults`, `pageAdditions`, and
  `presentCorpus`; session `loadMore`, `toggleFacet`, and `openFixedCorpus`.
- **Protocol semantics / limits:** Corpus identity is event ID. Pagination
  uses the oldest current `created_at` minus one as `until`; exact event or
  address lookups are non-pageable. Intersection pagination cannot add an ID
  not in the original intersection base. Display dedupe only affects visible
  results, not stored/retrieved corpus. Fixed corpora (archive, collection,
  checkpoints, scans, graph expansions) explicitly disable relay pagination.
- **State / persistence:** Solid session signals retain corpus, query plan,
  facets, page state, entry reasons, selected/pinned IDs, and up to eight
  checkpoints. Checkpoint event IDs are capped at 1,000 and their events are
  persisted before restore.
- **Locations:** `src/search-state.js`, `src/event-analysis.js:22-40`, and
  `src/research-session.js:99-145, 283-474`.
- **Current test coverage:** `src/search-state.test.js` covers all three set
  operations, intersection pagination, and separation of presentation from
  corpus. `src/event-analysis.test.js` covers display dedupe.
- **Assessment:** Set/presentation behavior is **suitable for extraction**;
  Solid signals, checkpoint UX, messages, and scrolling are
  **UI/application coordination**.
- **Uncertainties / contradictions:** Cursor paging assumes monotonically
  ordered timestamps and cannot prove completeness across relays. Replace
  searches clear the old corpus before all relays settle; tests establish that
  a verified empty replacement remains empty, but not partial-failure policy.

### 2.3a Private seed accounts and seed-directed research

- **Caller-visible behavior:** Maintains a private, local starting list of
  accounts for investigation. A caller can add or remove an account, open an
  account from the list, start a normal author search for one account, search
  recent activity from all usable seeds, or add one/all seeds as author
  direction signals for the next Relay Explorer scan. The list is explicitly
  described to the user as not being published to Nostr.
- **Inputs / outputs:** `addSeedAccount(value, name)`, `removeSeedAccount`,
  `isSeedAccount`, `searchAuthors`, `directOneSeed`, and `directAllSeeds`
  consume a 64-character hexadecimal public key, `npub`, or `nprofile`
  (plus an optional display name). Add returns `true`/`false` and changes the
  local list or sets a notice; remove updates the list. Batch activity search
  replaces the session corpus and reports per-relay states. Direction actions
  return/announce how many author signals were added.
- **Protocol semantics / limits:** Account input is decoded with
  `nostr-tools:nip19` only for `npub`/`nprofile`; it is normalized to lowercase
  hex and duplicates are rejected. Batch search deduplicates and considers at
  most 100 non-empty author keys, then queries the configured read relays for
  kinds 1, 6, 20, 21, 22, 1111, and 30023 using the current draft limit (also
  clipped per relay metadata). All-seed actions exclude globally blocked
  accounts before searching or directing. Relay Explorer holds at most eight
  author direction values, so directing all seeds stops after the remaining
  capacity; a directed scan is a separate, fixed corpus rather than a
  publication or follow operation.
- **State / persistence:** `src/app.jsx` owns the Solid `seedAccounts` signal
  and persists entries `{ pubkey, name, addedAt }` in localStorage key
  `nostr-research-seed-accounts-v1`; startup accepts legacy string entries
  whose public keys have the expected hexadecimal shape. Complete research
  package export includes seed accounts; there is no corresponding
  package-import path.
- **Locations:** Input parsing, add/remove, and local persistence are in
  `src/app.jsx:398-406, 469-486`; batch search is
  `src/research-session.js:294-340`; blocked-seed filtering and Relay Explorer
  direction actions are `src/app.jsx:741-749`; the eight-author direction
  ceiling is in `src/relay-explorer.js:28-57`; caller-facing private-list
  behavior is wired by `src/ui/settings-page.jsx:8`.
- **Current test coverage:** No direct tests cover seed parsing, localStorage
  persistence, batch seed search, or seed-to-direction capacity. The generic
  neighborhood-analysis test uses a seed author as analysis input, but does
  not exercise seed-account management.
- **Assessment:** **UI/application coordination.** Private-list persistence,
  notices, navigation, profile labels, and the decision to feed a scan
  direction belong to the application. The bounded author-search behavior may
  inform a later library specification, but should be **recreated cleanly**
  rather than treating the Settings flow as a library boundary.
- **Uncertainties / contradictions:** The advertised “all seeds” path removes
  blocked accounts, but the individual direct-scan action passes its supplied
  public key straight to the explorer; the explorer’s later runtime policy may
  filter its events, but the direction itself can still contain that blocked
  account. Persisted legacy entries are validated case-insensitively but are
  not normalized during startup, unlike newly added entries, so case-variant
  duplicates or membership comparisons are possible in old local state.

### 2.4 Local archive search and evidence sets

- **Caller-visible behavior:** Searches previously downloaded events locally,
  saves/reopens collections of pinned evidence, saves/reruns investigations,
  restores short history checkpoints, and compares a saved search’s latest
  run with the previous run.
- **Inputs / outputs:** `searchStoredEvents`, `loadEvents`, collection/recipe/
  run CRUD, and session `searchLocalArchive`. Outputs are cached event arrays,
  saved records, run deltas, or fixed corpora.
- **Protocol semantics / limits:** Local term search requires terms of at least
  three Unicode letters/numbers/`_.-`, ANDs every term, orders by stored event
  timestamp, and caps at 250. Structured local constraints are re-applied;
  archive search never asks relays for another page. Saved recipes, their
  baseline/run records, and evidence collections retain their full event-ID
  arrays (no explicit persistence cap). By contrast, the browser search
  session, Relay Explorer pulse snapshot (current and prior IDs), and corpus
  checkpoints each store at most 1,000 event IDs; pinned browser-session IDs
  cap at 150.
- **State / persistence:** IndexedDB database `nostr-research` v3 stores
  `events`, `eventSearch`, `recipes`, `collections`, and `runs`. Event records
  embed `_research.storedAt` and relay provenance; search terms are capped at
  400/event. Recipes/collections/runs plus browser session state are durable.
- **Locations:** `src/research-store.js`, session archive method in
  `src/research-session.js:335-354`, and saved-state orchestration in
  `src/app.jsx:552-706`.
- **Current test coverage:** `src/correctness-boundaries.test.js` verifies
  failure when IndexedDB is unavailable; no IndexedDB implementation tests
  cover migrations, indexing, deletion, collection/recipe/run CRUD, or query
  correctness.
- **Assessment:** Archive semantics should be **recreated cleanly**; saved
  investigation and evidence workflow are **application coordination**.
- **Uncertainties / contradictions:** `storeEvents` writes the event and its
  search row in separate transactions, so a failure can leave them divergent.
  `deleteEventsByAuthors` matches stored `pubkey` exactly while moderation
  normalizes blocked keys to lowercase; Nostr keys are normally lowercase but
  this is not enforced on archived input. `searchStoredEvents` accepts dotted
  query terms via `/[\p{L}\p{N}_.-]{3,}/gu`, but `indexTerms` tokenizes event
  content with `/[\p{L}\p{N}_-]{3,}/gu` and excludes dots. Consequently a
  content query such as `foo.bar` can be accepted yet fail to find an event
  whose content was indexed only as `foo` and `bar` (`src/research-store.js:97-140`).

## 3. Relationship and protocol interpretation

### 3.1 Relationship navigation and graph expansion

- **Caller-visible behavior:** From a selected event, fetches replies/comments,
  quotes, reactions/reposts/zaps, author activity, author mentions, shared
  topics, roots/parents/citations, or an author’s follow network. Returned
  events can replace, union with, or intersect the current corpus and carry a
  human-readable entry reason.
- **Inputs / outputs:** `createResearchSession(...).expandSelection(relation)`
  and selected event/operation. Outputs update corpus and expansion status.
- **Protocol semantics / limits:** Replies query `#e` for kinds 1/1111 and `#E`
  for kind 1111; quotes query `#q`; responses query kinds 6/7/16/9735;
  topics use at most four tags; references use at most the current per-relay
  limit. Network uses the newest fetched kind 3 and at most 80 followed keys,
  then reads note/media/article kinds. Expansion reads configured general
  relays through the runtime cache.
- **State / persistence:** Uses session selection, corpus, operation token,
  entry reasons, and checkpoint persistence; incoming events are remembered
  and runtime-persisted.
- **Locations:** `src/research-session.js:356-448`; event action wiring in
  `src/app.jsx:720-760`; protocol derivation in `src/protocol-semantics.js`.
- **Current test coverage:** No direct expansion tests. Relationship parsing
  that powers root/parent/reference expansion is tested in
  `src/protocol-semantics.test.js`.
- **Assessment:** Relationship filter definitions should be **recreated
  cleanly**; selected-note handling, notifications, and corpus UX are
  **UI/application coordination**.
- **Uncertainties / contradictions:** “references” mixes event IDs from
  several tag forms but cannot resolve address/external references. An event’s
  quoted/reply relations rely on tag conventions and relay coverage, not a
  complete graph.

### 3.2 Nostr event semantics, lifecycle, and tag labeling

- **Caller-visible behavior:** Interprets event class, addressable identity,
  NIP-10/NIP-22 thread roles, mentions, quotes, references, addresses,
  external references, relay hints, and label text for tags; marks present
  corpus events as current, superseded, or deletion requested.
- **Inputs / outputs:** `parseEventSemantics`, `describeTag`, and
  `reconcileEventState` consume event objects and return structured semantics,
  tag descriptors, or ID-keyed lifecycle maps.
- **Protocol semantics / limits:** Treats kinds 0, 3, and 10000–19999 as
  replaceable; 20000–29999 as ephemeral; 30000–39999 as addressable with
  `kind:pubkey:d`. For kind 1, unmarked `e` tags infer first root/last parent;
  marked root with no parent treats root as parent. Kind 1111 uses upper-case
  root tags and lower-case parent tags. Deletion kind 5 affects only an
  in-corpus target from the same pubkey; no signature verification is done.
- **State / persistence:** Pure computation, except event state only has
  meaning within the provided corpus.
- **Locations:** `src/protocol-semantics.js`; presentation in
  `src/app.jsx:1202-1255`; graph preparation in `src/event-analysis.js`.
- **Current test coverage:** `src/protocol-semantics.test.js` covers event
  class/address, marked NIP-10, NIP-22 root/parent, tag labels, replacement,
  and same-author deletion. No test covers all tag variants or malformed data.
- **Assessment:** **Suitable for extraction** as an explicitly documented
  interpretation layer, provided its incomplete/heuristic rules remain
  visible.
- **Uncertainties / contradictions:** Classifying every 10000–19999 kind as
  replaceable is a broad rule. The inferred unmarked-thread behavior is
  intentionally heuristic; it must not be presented as authoritative NIP-10
  structure. “Deletion requested” is correctly cautious, but UI may still
  display content.

### 3.3 Rendering-related event preparation and corpus views

- **Caller-visible behavior:** Prepares stable data for note rows and visual
  lenses: kind names, tags, URL/domain/media extraction, content duplicate
  groups, bounded multi-entity graph, threads, timeline, map facets, and
  account/topic/relay comparisons. Content rendering recognizes URLs, Nostr
  identifiers, hashtags, lightweight bold/code fragments, and image/video/
  audio URLs.
- **Inputs / outputs:** Helpers in `event-analysis.js` and graph model;
  Solid view components consume events/profiles/provenance and return UI.
- **Protocol semantics / limits:** URL parsing is regex-based and only handles
  `http(s)` content URLs. Media classification is extension-based. Display
  duplicate fingerprints only cover note-like kinds 1/20/21/22/30023, require
  normalized content of at least 24 characters, and preserve first-event
  provenance plus duplicate IDs/authors. Graphs are bounded to 30 events and
  10 entities per dimension, retaining only references whose IDs are in the
  corpus.
- **State / persistence:** Pure helper outputs; view-specific state (shown-row
  count, graph focus, comparison selection) is Solid local state.
- **Locations:** `src/event-analysis.js`, view functions in
  `src/app.jsx:1085-1192, 1224-1255`.
- **Current test coverage:** `src/event-analysis.test.js` covers URL/media/
  domain extraction, kind parsing, duplicate grouping, and graph bounds/edges.
  No renderer/component tests exist.
- **Assessment:** Data preparation is **suitable for extraction** subject to
  a clear heuristic contract; actual rendering is **UI/application
  coordination**.
- **Uncertainties / contradictions:** Content “Markdown” is lightweight custom
  splitting rather than a standards-compliant renderer. Content-derived domain
  or media facts do not cover tagged URLs or remote MIME types.

## 4. Moderation, portability, and privacy-sensitive behavior

### 4.1 Global moderation and archive removal

- **Caller-visible behavior:** Blocks accounts and case-insensitive name
  substrings globally; mutes accounts, topics, words, events, and relay-sourced
  events; filters collection, search, explorer, reopened archive, and stored
  data. Blocking an account removes its matching archived events and current
  in-memory data; unblocking does not restore deleted archive data.
- **Inputs / outputs:** `createModerationPolicy`, account/name/rule changes,
  and event source lookup. `allowedEvents` returns only permitted events;
  matching helpers return the matching reason/pattern.
- **Protocol semantics / limits:** A muted relay excludes an event only when
  every recorded source is muted; an event with any allowed source remains.
  Name rules require loaded profile metadata and inspect only `display_name`
  and `name`. Word mute is lowercase substring matching, not token matching.
  Relay mute normalization requires `wss://` in application input. Raw account
  blocks are added to the NIP-51 draft but are separately stored.
- **State / persistence:** Policy has closure-local blocked sets, name profile
  cache, and rules. App persists account/name/mute settings in localStorage;
  `removeAuthorsFromResearch` clears runtime sources, in-memory records,
  corpus/pins/routes, and IndexedDB events.
- **Locations:** `src/moderation.js`, `src/block-rules.js`,
  `src/research-portability.js:eventMatchesMuteRules`, and app wiring/removal
  in `src/app.jsx:62-76, 389-483`.
- **Current test coverage:** `src/block-rules.test.js`,
  `src/research-portability.test.js`, and `src/correctness-boundaries.test.js`
  cover name matching, mute reason, and provenance-aware relay muting. No
  integration tests verify all stores/views are cleared.
- **Assessment:** Core matching and provenance rule should be **recreated
  cleanly**; global mutable policy and destructive UI workflow are
  **application coordination**.
- **Uncertainties / contradictions:** `allowedEvents` applies `eventMatchesMuteRules`
  with relay rules removed and handles relay sources separately; this is
  deliberate but non-obvious. Name blocks cannot block events before profile
  metadata is fetched, so already seen content may remain briefly.

### 4.2 Portable mute lists and research provenance export

- **Caller-visible behavior:** Imports a public kind 10000 mute-list JSON
  event into local rules; exports an unsigned mute-list draft; exports a
  research manifest or complete local research package without publishing or
  signing anything.
- **Inputs / outputs:** `muteRulesFromEvent`, `muteEventDraft`, and
  `createResearchManifest`; browser download of JSON files.
- **Protocol semantics / limits:** Parses only kind 10000 and validates hex
  account/event IDs plus `wss://` relay values. Export draft has kind 10000,
  empty content, supplied pubkey, current seconds timestamp, and p/t/word/e/
  relay tags. Manifest v1 has sorted unique event IDs, a deterministic FNV-like
  32-bit fingerprint, relay result state/count/duration, current exclusions,
  query, constraints, strategy, and collection timestamp. Complete package
  adds pinned raw events, seed accounts, mute draft, scan direction, decisions.
- **State / persistence:** Exports are ephemeral browser downloads; inputs use
  app state and persisted rule/evidence data.
- **Locations:** `src/research-portability.js`; import/export in
  `src/app.jsx:518-551`; Settings UI in `src/ui/settings-page.jsx`.
- **Current test coverage:** `src/research-portability.test.js` covers mute
  round trip, match reason, and order-independent manifest fingerprint.
- **Assessment:** Manifest/mute transformations are **suitable for extraction**
  only with a documented format contract; browser download and package assembly
  are **application coordination**.
- **Uncertainties / contradictions:** The fingerprint is a reproducibility
  hint, not cryptographic integrity. Import trusts pasted JSON as a “public”
  mute-list event but performs no signature verification or publication-status
  check. The application has no research-package import implementation; the
  complete-package format is currently export-only.

## 5. Exploration and analysis

### 5.1 Relay Explorer baseline and directed scans

- **Caller-visible behavior:** Runs a bounded recent-time relay sample and a
  previous-window comparison, exposes pulse progress/coverage, lets a user
  pursue topics/accounts/domains/events, and continues with adjacent, broader,
  closer, network, crosscheck, or skeptical directed plans. A scan can be
  opened as a fixed Search corpus with per-event reasons.
- **Inputs / outputs:** `createRelayExplorer` signals/actions (`scan`,
  `continueScan`, `pursue`, `addAuthors`, etc.); scan settings are time window,
  depth, scope, and up to four relays. Output includes event sets, progress,
  metadata, direction, round, and reason map.
- **Protocol semantics / limits:** Friendly scopes map to explicit Nostr kind
  lists. Baseline floors time to a minute, slices large requested depths into
  contiguous windows of at most 500 events/filter, and reads current plus an
  equal previous window. Directed scan: each direction category caps at eight;
  topic searches issue both `#t` and keyword NIP-50 plans; account network
  reads follow lists and caps discovered contacts at 100; skeptical mode reads
  report/label kinds 1984/1985. Directed/broad limits cap at 500.
- **State / persistence:** Solid controller state; settings/direction/strategy
  persist in localStorage. On visiting Relay Explorer, pulse event IDs,
  prior IDs, metadata, round, and reasons restore from localStorage +
  IndexedDB, each ID list capped at 1,000.
- **Locations:** `src/relay-explorer.js`, `src/pulse-analysis.js`, and app
  restoration/open-in-search orchestration in `src/app.jsx:202-275, 379-388`.
- **Current test coverage:** `src/pulse-analysis.test.js` covers scope mapping,
  time slices, coverage output, independent-participation scoring, and noisy
  accounts. `src/neighborhood-analysis.test.js` covers reason transparency.
  No controller scan/persistence/cancellation tests exist.
- **Assessment:** Planning and analysis portions should be **recreated
  cleanly**; Solid controller, local persistence, notices, and screen flow are
  **UI/application coordination**.
- **Uncertainties / contradictions:** The explorer’s “requested” count is a
  planned upper bound, not observed relay results. `cancel` invalidates state
  updates but does not cancel outstanding transport requests. “Skeptical”
  reports are explicitly subjective claims, not reputation verification.

### 5.2 Pulse and neighborhood analysis

- **Caller-visible behavior:** Computes topic/account/conversation/domain/kind
  signals, relay overlap and roles, likely noise accounts, and transparent
  neighborhood candidates relative to a chosen direction.
- **Inputs / outputs:** `analyzePulse(current, previous, relays, sourcesFor)`
  and `analyzeNeighborhood(events, direction, sourcesFor)` return ranked plain
  objects containing counts, scores, role/signal labels, evidence IDs, and
  explanatory reasons.
- **Protocol semantics / limits:** Topic signals require at least two authors,
  rank up to 18, penalize author dominance, and compare earlier-window author
  counts. Account noise is heuristic (at least 8 events with low originality
  or above 80/day); results cap recommended/noise accounts at 12. Neighborhood
  vocabulary uses 5+ character tokens and a short hard-coded stopword list;
  candidates cap at 50 and evidence IDs at 12. Relay analysis depends entirely
  on supplied provenance.
- **State / persistence:** Pure, except caller-owned source lookup; no direct
  persistence.
- **Locations:** `src/pulse-analysis.js`, `src/neighborhood-analysis.js`,
  invoked by `src/relay-explorer.js`.
- **Current test coverage:** `src/pulse-analysis.test.js` and
  `src/neighborhood-analysis.test.js` cover representative rankings and
  explanations, not calibration on real corpora.
- **Assessment:** **Questionable/heuristic until product validation.** These
  may be valuable analysis utilities, but scores/labels encode editorial
  assumptions and should not become library policy by default.
- **Uncertainties / contradictions:** “originality,” “noise,” relay roles, and
  neighborhood similarity are heuristic labels based on an incomplete sample;
  they can be biased by relay coverage and content repetition.

## 6. Application persistence, logging, and deployment

### 6.1 Browser state, session recovery, and portability boundaries

- **Caller-visible behavior:** Remembers editable keyword relays, search
  session/corpus settings, recent decisions/checkpoints, blocks/mutes/seeds,
  scan settings/direction/strategy, and explorer snapshot across reloads.
  “New exploration” clears only active session/memory, preserving saved
  recipes and collections.
- **Inputs / outputs:** Browser localStorage load/save wrapper and IndexedDB
  archive; application startup restores these records where present.
- **Protocol semantics / limits:** No Nostr events are signed or published for
  any of this state. Session serializer intentionally keeps bounded IDs and
  decisions rather than the raw complete corpus. Legacy localStorage keys are
  deleted at module evaluation.
- **State / persistence:** localStorage keys are declared in
  `src/app.jsx:21-36`; IndexedDB details are in capability 2.4. Failure to save
  localStorage returns `false` but most callers do not report it. Startup only
  restores events that still exist in IndexedDB and pass current moderation.
- **Locations:** `src/app.jsx:49-76, 688-735`; `src/research-store.js`.
- **Current test coverage:** No localStorage/session restoration tests; only
  IndexedDB-unavailable behavior is tested in
  `src/correctness-boundaries.test.js`.
- **Assessment:** **UI/application coordination.** Persistence schemas and
  user-workflow expectations must be deliberately chosen for any library.
- **Uncertainties / contradictions:** `save`’s quota fallback removes the key
  before retrying, risking loss of prior valid state. Module-evaluation access
  to `localStorage` makes this client non-portable to SSR/non-browser contexts.

### 6.2 Local usage logging and local server

- **Caller-visible behavior:** Sends best-effort client telemetry for searches,
  relay outcomes, moderation, scan actions, persistence failures, and startup
  to `/api/log`; the bundled local HTTP server appends it as JSON Lines and
  serves the built client (or source root during development) on loopback.
- **Inputs / outputs:** `logUsage(type, detail)` sends JSON; server accepts
  POST body up to 32,768 characters and responds 204 or 400. Logs are appended
  with server timestamp to `logs/usage.ndjson`.
- **Protocol semantics / limits:** No Nostr publication occurs. Static server
  blocks HTTP access to `/keys/` and `/logs/`, binds `127.0.0.1`, emits
  no-store responses, and prevents normalized paths outside its static root.
  Vite proxies `/api` in development. Key-generation makes a local unencrypted
  secp256k1 identity file; it is not used by application behavior.
- **State / persistence:** Append-only filesystem logging and optional
  `keys/dev-user.json`; browser ignores fetch logging failures.
- **Locations:** `src/app.jsx:85-87`, relay/session/explorer log calls,
  `server.mjs`, `vite.config.js`, `scripts/generate-keys.mjs`, and README.
- **Current test coverage:** No server, logging, static-path, or key-script
  tests.
- **Assessment:** Server logging and key tooling are **application/development
  coordination**, not evidence of a research-library feature. Event-level
  telemetry hooks may be worth a clean optional abstraction.
- **Uncertainties / contradictions:** The README says telemetry is local, but
  Vite’s proxy means it can only be local under the documented development
  setup. The logging endpoint accepts arbitrary JSON fields and lacks schema,
  rotation, and explicit redaction; query strings and IDs may be sensitive.
