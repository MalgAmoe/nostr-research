# Nostr Research

An early, local SolidJS and Tailwind client for Nostr discovery and research rather than a social feed.

## Current capabilities

- Topic, account, event, NIP-05, and NIP-50 keyword discovery using real relay data.
- Relationship traversal from a selected event: replies, quotes, references, author activity, mentions, shared topics, reactions, reposts, and zaps.
- Corpus facets for topics, accounts, event kinds, domains, relays, and activity dates, plus a configurable comparative Relay Pulse for rising topics, accounts, domains, media, relay overlap, and sample coverage.
- Explore, Analyze, and Map workspaces with list, thread, timeline, table, comparison, matrix, corpus-map, and relationship-graph views.
- Rich note rendering for images, video, audio, links, Nostr references, hashtags, and lightweight Markdown.
- Configurable per-relay research depth, cursor-based retrieval of older results, and optional display-time duplicate collapsing.
- A central selected-note research panel, evidence collections, relay provenance, restorable corpus checkpoints, reusable recipes, and run comparisons.
- Durable IndexedDB event storage and indexed local search across previously retrieved real events.

There is no sample or fake corpus. The home screen samples recent public events from the configured read relays to derive navigable topics and accounts. The client does not sign events, publish content, or alter relays.

The default search relay set is editable in the interface. Searches use NIP-50 where the selected relay supports it. General event reads use separate read relays, bounded short-lived caching, background profile hydration, and paginated account collections. A relay's state, event count, response time, advertised query limit, and contribution are shown after every query.

## Local usage logging

While the local server is running, the client writes append-only JSON Lines telemetry to `logs/usage.ndjson`. It records queries, relay response status/timing, research actions, and saved-path summaries so we can see what the client is actually doing. This file remains in this project directory; it is not sent to any third party beyond the selected public relays required for a query.

## Local development identity

`keys/dev-user.json` contains a generated, unencrypted development keypair in hexadecimal and NIP-19 (`nsec` and `npub`) forms. Run `npm run keys:generate` to replace it. The local server blocks HTTP access to both `keys/` and `logs/`; treat the identity as disposable and never fund it.

## Run locally

Requires Node.js 20+.

```sh
npm install
npm run build
npm start
```

For Tailwind/Solid development with hot reload, keep the local API server running and use `npm run dev`; Vite serves the interface on http://127.0.0.1:5173 and proxies usage logs to port 4173.

Open http://localhost:4173.

## Project shape

The project intentionally stays small: one Solid application module, one event-analysis module, one IndexedDB storage module, and one relay-information module. New seams should only be introduced when they improve locality or make independently testable domain logic clearer.

Potential future work includes NIP-65 relay discovery, optional encrypted cross-device sync, and explicit NIP-51 sharing for selected collections. Private local research state should remain separate from anything published to Nostr.
