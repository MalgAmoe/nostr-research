# SQLite portability spike

Status: historical; superseded by the removal of SQLite in task 026.

The project evaluated `@tursodatabase/database-wasm` as a shared SQLite
implementation for Node and browser environments.

The browser worker remained responsive for a small corpus, but ingestion
stalled at larger test sizes and did not provide a dependable basis for the
research client. The experiment did not justify replacing Node's built-in
SQLite support.

At the time, the experiment did not justify replacing Node's built-in SQLite
support. The executable spike was removed after recording that conclusion.

The project subsequently removed SQLite entirely. The current runtime uses one
bounded, process-local in-memory corpus and deliberately has no persistence or
database abstraction. This document remains only as the record of the earlier
portability experiment.
