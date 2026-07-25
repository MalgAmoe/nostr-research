# Current functional dependency map

Arrows show current dependency direction, not a recommended future layering.
The reference client is a Solid/browser application with a few pure helpers;
the useful-looking controllers still depend on reactive state and injected
application callbacks.

## Functional graph

```text
src/app.jsx (module globals + Solid App + browser routes)
  ├─ createModerationPolicy ──> src/moderation.js
  │     ├─ src/block-rules.js
  │     └─ src/research-portability.js:eventMatchesMuteRules
  ├─ createNostrRuntime ──> src/nostr-runtime.js ──> nostr-tools:SimplePool
  │     ├─ policy callbacks from app (isEventAllowed/isRelayAllowed)
  │     ├─ src/research-store.js:storeEvents
  │     └─ app.jsx:logUsage ──> fetch('/api/log') ──> server.mjs
  ├─ createResearchSession ──> src/research-session.js (Solid signals/store)
  │     ├─ src/query-spec.js ──> src/event-analysis.js
  │     ├─ src/search-state.js ──> src/event-analysis.js
  │     ├─ src/protocol-semantics.js
  │     ├─ nostr-tools:nip19
  │     ├─ runtime + relay/store/profile/route/DOM callbacks from app
  │     └─ fetch NIP-05 (browser global)
  ├─ createRelayExplorer ──> src/relay-explorer.js (Solid signals)
  │     ├─ src/pulse-analysis.js ──> event-analysis + protocol-semantics
  │     ├─ src/neighborhood-analysis.js ──> event-analysis
  │     └─ runtime/profile/localStorage/notice callbacks from app
  ├─ src/research-store.js ──> indexedDB + event-analysis:eventDomains
  ├─ src/relay-info.js ──> fetch + module-global relayInfoCache
  ├─ src/relay-planner.js
  ├─ src/research-portability.js
  ├─ src/ui/*.jsx + local presentation functions ──> Solid + browser DOM
  └─ src/styles.css

server.mjs ──> node:http/fs/path (static client + append-only logs)
scripts/generate-keys.mjs ──> node:crypto/fs (development identity only)
```

## Dependency directions by concern

| Concern | Current direction | Coupling that matters to extraction |
|---|---|---|
| Transport/provenance | `app.jsx` creates `createNostrRuntime` → `SimplePool`; runtime calls app-provided policy, persistence, and telemetry | Runtime has a sound injection seam but makes side effects during collection. `sources` and cache are private module-instance state; result state is hidden on an Array. |
| Query behavior | `createResearchSession` → `query-spec` / `search-state` → `event-analysis` | Helpers are mostly pure. The session also owns fetch/NIP-19 resolution, relay execution, race tokens, profile hydration, notifications, routes, and persistence callbacks. |
| Corpus/relations | Session → runtime → application `knownEvents`/profile callbacks; session → `protocol-semantics` | Relationship behavior cannot run independently without event lookup, relay access, persistence, and a state model. |
| Moderation | App module-global `moderation` → runtime policy and `allowedEvents` → store/session/explorer/route filtering | Blocking mutates app `knownEvents`, Solid signals, runtime provenance/cache, route data, pins, and IndexedDB. Name rules depend on profile hydration ordering. |
| Archive | App/session → `research-store` → IndexedDB; store → `event-analysis:eventDomains` | IndexedDB availability is an implicit browser requirement. Database promise is module-global; stored provenance is rehydrated into runtime state by callers. |
| Relay exploration | App → `createRelayExplorer` → runtime + analysis | Explorer combines Solid state, localStorage callbacks, notice UI, profile hydration, and scan algorithm. Analyses themselves accept supplied data/provenance. |
| Portability | App → `research-portability` → Blob/URL/document download | Manifest and mute transforms are pure, but package composition pulls from all application state and browser download APIs. |
| Rendering | `app.jsx` views → event/protocol helpers + profiles + runtime provenance | Graph and comparison helpers use source callbacks; every actual lens is Solid JSX and uses DOM/browser navigation. |
| Logging | Runtime/session/explorer/app → `logUsage` → browser fetch → `server.mjs` filesystem append | Telemetry is a cross-cutting injected callback at controller level but a module-global function in app wiring. Server is separate Node runtime and assumes local filesystem. |

## Concrete extraction barriers

### Solid reactive state

- `src/research-session.js:createResearchSession` imports `createSignal`,
  `createMemo`, and `createStore`, returns getter/setter functions, and embeds
  request/paging/expansion token variables. Its tests require `createRoot`
  (`src/research-session.test.js`).
- `src/relay-explorer.js:createRelayExplorer` imports `createSignal` and
  `createMemo`; persisted settings are written directly through supplied
  callbacks during state mutation.
- `src/app.jsx:App` is the owner of cross-controller selection, corpus,
  profiles, route data, saved state, decision history, collections, and
  moderation reconciliation. The controllers are not a complete domain model.

### Browser APIs and browser-only execution

- `src/app.jsx` uses `localStorage` at module evaluation, `location.hash`,
  `history`, `window` events/confirmation, `document` focus/scroll/download,
  `Blob`, `URL.createObjectURL`, `crypto.randomUUID`, `queueMicrotask`,
  `performance`, and `fetch`.
- `src/research-store.js` requires `globalThis.indexedDB`; it rejects writes
  when absent and returns empty reads when opening fails.
- `src/relay-info.js` and NIP-05 resolution in `src/research-session.js` use
  global `fetch`; neither accepts a fetch implementation or abort signal.
- `src/nostr-runtime.js` relies on `performance` and timers as globals in
  addition to `nostr-tools` WebSocket behavior.

### Module globals and process globals

- `src/app.jsx` constructs `moderation` and `runtime` once at module scope,
  before `App`, making multiple independent app instances awkward and binding
  state to browser localStorage availability at import time.
- `src/research-store.js:databasePromise` retains one IndexedDB connection per
  module; `src/relay-info.js:relayInfoCache` retains every relay metadata
  promise indefinitely.
- `server.mjs` fixes project-root-derived `logs/` and static roots, uses
  `process.env.PORT`, and is not part of browser client modules.

### Application orchestration callbacks

`src/app.jsx` passes a wide dependency bag to both controllers. The session
requires runtime, relay selectors/metadata, relay inspection, policy filtering,
event cache access, profile hydration, decision/run telemetry, notifications,
route transition, DOM focus, archive reads/search/writes, and session limits.
This is evidence that `createResearchSession` is presently application
coordination—not an independently usable library surface.

The explorer similarly needs runtime, defaults, search relays, query cap,
profile hydration, a name-rule condition, notices, display shortening,
telemetry, and three persistence writers. These callbacks are useful seams,
but their breadth exposes missing explicit domain boundaries.

## Relatively independent lower-level transformations

The following have no direct browser/Solid imports and are the least coupled
starting points for later behavioral specification—not automatically the final
library modules:

- `src/block-rules.js`: normalization and substring match.
- `src/event-analysis.js`: tags, ranking, URL/media/domain extraction,
  display-deduplication, graph model (depends on protocol semantics).
- `src/protocol-semantics.js`: event/tag interpretation and in-corpus
  lifecycle reconciliation.
- `src/query-spec.js`: request/constraint transforms (depends on
  event-analysis).
- `src/search-state.js`: corpus set/presentation transforms (depends on
  event-analysis).
- `src/relay-planner.js`: relay URL/list/limit transforms.
- `src/research-portability.js`: mute and manifest transforms.
- `src/pulse-analysis.js` and `src/neighborhood-analysis.js`: pure but
  policy-heavy heuristic analysis.

Their tests provide examples of existing behavior: `src/*.test.js` exercises
all of the above except `relay-info.js`. Tests do not establish that these are
the desired public abstractions.
