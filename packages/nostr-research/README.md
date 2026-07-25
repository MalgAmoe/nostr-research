# Nostr Research memory

`@nostr-research/memory` is a small UI-independent library for a local, SQLite-backed
record of valid Nostr evidence and where it was encountered. It intentionally
contains no relay networking, UI, profile resolution, ranking, or relationship
indexes.

## Library

```js
import { openResearchMemory } from '@nostr-research/memory';

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

The package uses Node's built-in `node:sqlite` support and requires Node 22.5
or newer. SQLite files are generated artifacts and are ignored by Git.

## CLI

All commands operate on the same public library and require a database path:

```sh
nostr-research-memory --db ./research.sqlite init
nostr-research-memory --db ./research.sqlite import-fixture --relay wss://relay.example
nostr-research-memory --db ./research.sqlite summary
nostr-research-memory --db ./research.sqlite inspect 78c49d12afd45ddadb9b547051c344352060a9aa9a1665de8fd8695b4aa8d30c
nostr-research-memory --db ./research.sqlite reset
```

Run `nostr-research-memory --help` for commands and options. Successful
commands print JSON for scripting and inspection; invalid commands, missing
events, and invalid input exit non-zero with an `Error:` message.
