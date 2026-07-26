CHANGES_REQUIRED

1. `README.md:14-22` still describes a persistent SQLite-backed console and instructs users to pass `--db .data/research.sqlite`. Update the active root documentation to describe the bounded process-local corpus, current `--capacity` invocation, loss of state on exit/reset/close, and absence of persistence/database format.

2. Active functional-test terminology still preserves obsolete persistence claims: `packages/nostr-research/test/orientation.functional.test.js:10` says “durable investigation,” while `packages/nostr-research/test/console.functional.test.js:75,102` calls the same-process count `persistentCount`. Rename these to process-local terminology so tests no longer imply durability.