# Turso portability spike

This spike tests whether the Nostr research store can use the same database
engine, schema, and query code in a browser and in Node.

It deliberately stays outside the production library. It is evidence for a
storage decision, not a migration.

## What it exercises

- the current store's event, observation, relationship, and research-set shapes
- JSON extraction and expression indexes
- foreign keys
- transactions and rollback
- closing and reopening a persistent database
- a small ingestion workload

The browser uses `@tursodatabase/database-wasm` with OPFS. Node uses
`@tursodatabase/database` with a local file.

## Run it

```sh
npm install
npm run native
npm run serve
```

Open `http://127.0.0.1:4321`. The default browser scenario uses 100 events.
`?events=1000` runs the larger stress case.

The local server exists only to provide the cross-origin isolation headers
required by the threaded WASM runtime. The page is a diagnostic harness, not a
product UI.

## Results on 2026-07-25

| Scenario | Result |
| --- | --- |
| Node native, 1,000 events / 2,199 writes | Passed in about 263 ms |
| Browser WASM + OPFS, 100 events / 219 writes | Passed in about 97–214 ms |
| Browser reopen and integrity check | Passed |
| JSON queries and expression indexes | Passed |
| Foreign-key rejection | Passed |
| Intentional transaction rollback | Passed |
| Browser WASM + OPFS, 250 events / 549 writes | Did not complete after 60 s |
| Browser WASM + OPFS, 1,000 events / 2,199 writes | Did not complete after 70 s |

Both per-statement writes in one transaction and chunked `batch()` calls were
tried. The larger browser workload still stalled. This is not evidence that all
Turso browser ingestion is intrinsically slow; it is evidence that version
0.7.1 and this straightforward use of its public API are not safe enough for
our expected research workload.

## Decision

Do not migrate the production store yet.

Turso is directionally a strong fit:

- native and browser packages expose the same asynchronous API;
- the useful subset of our schema and SQL works in both runtimes;
- browser persistence through OPFS works;
- a later sync layer is possible without making remote connectivity mandatory.

But two costs are currently too important to accept:

1. Browser ingestion has an unresolved scaling cliff above the tiny corpus.
2. The current research library is synchronous around `node:sqlite`; adopting
   Turso correctly means making the storage boundary and its callers async.

The same engine does not mean the same physical database. A browser OPFS file
and a server file remain separate stores unless an explicit synchronization
mechanism is added.

## Recommended next move

Keep `node:sqlite` for the current library while shaping new public operations
so they do not expose synchronous database details. Revisit Turso when either:

- the browser ingestion behavior is explained or fixed upstream, or
- we can test the sync packages against an actual local/server exchange.

If revisited, migrate one complete operation vertically—ingest, query,
relationships, and persistence—rather than introducing a broad database
abstraction first.
