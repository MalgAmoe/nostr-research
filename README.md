# Nostr Research

An early, local SolidJS and Tailwind client for Nostr discovery and research rather than a social feed.

## Current capabilities

- Topic, account, event, NIP-05, and NIP-50 keyword discovery using real relay data.
- Relationship traversal from a selected event: replies, quotes, references, author activity, mentions, shared topics, reactions, reposts, and zaps.
- Corpus facets for topics, accounts, event kinds, and activity dates, plus a sampled 24-hour relay pulse on the home screen.
- Synchronized list, thread, timeline, relation-map, and account-by-kind matrix views.
- Rich note rendering for images, video, audio, links, Nostr references, hashtags, and lightweight Markdown.
- Cursor-based retrieval of older results and optional display-time duplicate collapsing.
- A central selected-note research panel, evidence basket, relay provenance, bounded recovery state, and explicitly saved investigations.

There is no sample or fake corpus. The home screen samples recent public events from the configured read relays to derive navigable topics and accounts. The client does not sign events, publish content, or alter relays.

The default search relay set is editable in the interface. Searches use NIP-50 where the selected relay supports it. General event reads use separate read relays, short-lived caching, background profile hydration, and paginated account collections. A relay's state, event count, and response time are shown after every query.

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

## Next milestones

1. Split relay access, research state, and rendering components out of the current single application module.
2. Add relay discovery using NIP-11 and NIP-65.
3. Add a local event cache and richer provenance records.
4. Add optional encrypted cross-device sync for saved investigations.
5. Add explicit sharing as NIP-51 curation sets, separately from private research paths.
