#!/bin/sh
set -eu

test -s packages/nostr-research/package.json
test -s packages/nostr-research/README.md

npm test --workspace packages/nostr-research
npm run check --workspace packages/nostr-research

tmp_db="${TMPDIR:-/tmp}/nostr-research-workflow-$$.sqlite"
trap 'rm -f "$tmp_db" "$tmp_db-shm" "$tmp_db-wal"' EXIT

npm exec --workspace packages/nostr-research -- nostr-research-memory --db "$tmp_db" init
npm exec --workspace packages/nostr-research -- nostr-research-memory --db "$tmp_db" import-fixture
npm exec --workspace packages/nostr-research -- nostr-research-memory --db "$tmp_db" summary
