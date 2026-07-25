# Nostr Research memory

`@nostr-research/memory` is a small UI-independent library for a local, SQLite-backed
record of valid Nostr evidence and where it was encountered. It intentionally
contains no UI, profile resolution, ranking, or relationship indexes. Its
bounded acquisition operation is deliberately separate from local inspection.

## Library

```js
import { acquireRelayEvents, openResearchMemory } from '@nostr-research/memory';

const memory = openResearchMemory('./research.sqlite');
try {
  memory.ingest(event, {
    relay: 'wss://relay.example',
    observedAt: '2026-07-25T12:00:00.000Z',
  });

  console.log(memory.getEvent(event.id));
  // { event: <the unchanged Nostr event>, observations: [...] }
  console.log(memory.summary());
  // { events: 1, observations: 1 }
} finally {
  memory.close();
}
```

`ingest` accepts only canonical Nostr events: required event fields and tag
structure must be valid, the event ID must match the canonical serialisation,
and the Schnorr signature must verify. An event ID is stored once; every ingest
adds an independent observation.

`loadFixtureEvents()` returns a fresh copy of the committed, inspectable fixture
corpus in `fixtures/events.json`. `memory.importFixtures(observation)` imports
that corpus through the same validation and ingestion boundary.

### Live relay acquisition

`acquireRelayEvents(memory, options)` contacts only the explicit `wss://`
relay URLs in `options.relays`. It accepts one NIP-01 filter object and returns
a structured result; it never supplies a default relay. The conservative
defaults are a 10,000 ms operation timeout, 100 accepted event observations,
and four concurrent relays. Callers can override these with `timeoutMs`,
`eventLimit`, and `concurrency`, and can cancel in flight with an
`AbortSignal`:

```js
const controller = new AbortController();
const result = await acquireRelayEvents(memory, {
  relays: ['wss://relay.example/'],
  filter: { kinds: [1], limit: 20 },
  timeoutMs: 5_000,
  eventLimit: 20,
  signal: controller.signal,
});
```

`completionReason` is `completed` when every selected relay reaches a terminal
outcome, or `limit`, `timeout`, or `cancelled` when that global stop condition
wins. Each relay separately reports `eose`, `closed`,
`connection-failure`, `limit`, `timeout`, or `cancelled`, with a diagnostic
where useful.

The returned counts have these stable meanings:

- `received`: subscription-matching `EVENT` messages received, valid or not;
- `invalid`: received events rejected by canonical event/signature validation;
- `observations`: valid events accepted before the global event limit, each of
  which creates one relay/timestamp observation;
- `newlyStored`: accepted observations whose canonical event was not already
  in memory;
- `duplicate`: accepted observations whose event was already in memory.

`acquiredEventIds` contains each event ID accepted by this operation once.
Thus `newlyStored + duplicate === observations`, while invalid events are
never persisted. The operation sends NIP-01 `CLOSE` and closes every socket it
owns when a relay completes or a global stop condition occurs.

The package uses Node's built-in `node:sqlite` support and requires Node 22.5
or newer. SQLite files are generated artifacts and are ignored by Git.

## CLI

All commands operate on the same public library and require a database path:

```sh
nostr-research-memory --db ./research.sqlite init
nostr-research-memory --db ./research.sqlite import-fixture --relay wss://relay.example
nostr-research-memory --db ./research.sqlite acquire \
  --relay wss://relay.damus.io \
  --relay wss://nos.lol \
  --filter-json '{"kinds":[1],"limit":10}' \
  --timeout-ms 5000 --event-limit 10
nostr-research-memory --db ./research.sqlite summary
nostr-research-memory --db ./research.sqlite inspect 78c49d12afd45ddadb9b547051c344352060a9aa9a1665de8fd8695b4aa8d30c
nostr-research-memory --db ./research.sqlite reset
```

Run `nostr-research-memory --help` for commands and options. Successful
commands print JSON for scripting and inspection; invalid commands, missing
events, and invalid input exit non-zero with an `Error:` message.

For acquisition, use exactly one of `--filter-json` or `--filter-file`; the
latter names a file containing one JSON filter object. Repeated `--relay`
arguments are required. Output is the same structured result returned by the
library plus the database path.
