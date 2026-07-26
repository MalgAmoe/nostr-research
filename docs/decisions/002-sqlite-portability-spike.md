# SQLite portability spike

The project evaluated `@tursodatabase/database-wasm` as a shared SQLite
implementation for Node and browser environments.

The browser worker remained responsive for a small corpus, but ingestion
stalled at larger test sizes and did not provide a dependable basis for the
research client. The experiment did not justify replacing Node's built-in
SQLite support.

The research library therefore continues to use `node:sqlite`. Storage remains
behind the library boundary so another implementation can be evaluated later
when a concrete deployment requires it. The executable spike was removed after
recording this conclusion.
