# Nostr Research memory

`@nostr-research/memory` is a small UI-independent library for a local, SQLite-backed
record of valid Nostr evidence and where it was encountered. It intentionally
contains no UI, ranking, recommendations, or trust scoring. Its bounded
acquisition operation is deliberately separate from local querying.

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

### Local query and navigation

`memory.searchEvents(query)` searches accumulated SQLite evidence and never
contacts relays. It accepts `ids`, `authors`, `kinds`, inclusive `since` and
`until` Unix timestamps, `tags`, `text`, `limit`, and `order` (`newest` or
`oldest`). ID and author values may be full values or unambiguous lowercase
hex prefixes of at least four characters.

Different constraint fields combine with AND. Multiple IDs, authors, kinds, or
values for one tag combine with OR. Every text term combines with AND and is
matched case-insensitively against note content. Different tag names combine
with AND. Tag names may include the conventional leading `#`; equivalent keys
such as `t` and `#t` are merged, so all their values retain the same OR
semantics. Results always have an explicit limit (default 50, maximum 1000)
and sort by `created_at`, then event ID. Each result contains the canonical
event, all observations, and one explicit match reason for every applied
constraint. Malformed and ambiguous constraints throw `ResearchMemoryError`;
a well-formed constraint matching nothing returns an empty result.

```js
const result = memory.searchEvents({
  authors: ['84bf7562262b'],
  kinds: [1],
  tags: { '#t': ['nostr'] },
  text: ['fixture'],
  since: 1_700_000_000,
  limit: 20,
  order: 'newest',
});
```

`resolveAccount(publicKeyOrPrefix)` returns the current stored kind-0 metadata
event, parsed profile, and its observations. Current-event selection follows
replaceable-event ordering: greatest `created_at`, then lowest event ID.
`searchAccounts({ publicKeys, text, limit })` searches only current metadata;
public-key prefixes may match multiple accounts, while all text terms must
match at least one of `name`, `display_name`, or `nip05`. Absence and ambiguous
prefixes are explicit errors for single-account resolution.

`relatedEvent(idOrPrefix)` and `relatedAccount(keyOrPrefix)` expose
evidence-backed outbound and inbound relationships. Relationships include
their direction, type, source event ID, source event and provenance, resolution
state, and protocol evidence. NIP-10 markers and NIP-22 root/parent tags are
reported as known interpretations; NIP-22 comment tags are interpreted only
on kind-1111 events. Deprecated unmarked NIP-10 positional interpretation and
uppercase event tags outside kind 1111 are labeled `best-effort-fallback`.
References to events not in memory remain in the result with `resolved:
false`. Account resolution reflects public keys evidenced as stored authors or
account references independently of whether kind-0 profile metadata is
available.

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
nostr-research-memory --db ./research.sqlite search --kind 1 --tag t=nostr --text fixture --limit 20
nostr-research-memory --db ./research.sqlite accounts --text alice
nostr-research-memory --db ./research.sqlite account 84bf7562262b
nostr-research-memory --db ./research.sqlite related event 78c49d12afd4
nostr-research-memory --db ./research.sqlite related account 84bf7562262b
nostr-research-memory --db ./research.sqlite reset
```

Run `nostr-research-memory --help` for commands and options. Successful
commands print JSON for scripting and inspection; invalid commands, missing
events, and invalid input exit non-zero with an `Error:` message.

For acquisition, use exactly one of `--filter-json` or `--filter-file`; the
latter names a file containing one JSON filter object. Repeated `--relay`
arguments are required. Output is the same structured result returned by the
library plus the database path.
