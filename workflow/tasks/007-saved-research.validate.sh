#!/bin/sh
set -eu

test -s packages/nostr-research/package.json
test -s packages/nostr-research/README.md

npm test --workspace packages/nostr-research
npm run check --workspace packages/nostr-research

npm exec --workspace packages/nostr-research -- nostr-research-memory --help |
  grep -q 'run'
npm exec --workspace packages/nostr-research -- nostr-research-memory --help |
  grep -q 'set'
