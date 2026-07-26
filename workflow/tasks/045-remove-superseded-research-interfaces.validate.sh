#!/bin/sh
set -eu

npm run check
npm test

test ! -e packages/nostr-research/src/console.js
test ! -e packages/nostr-research/src/session.js
test ! -e packages/nostr-research/bin/nostr-research-console.js

! rg -n "createResearchEnvironment|createResearchSession|ResearchSession|nostr-research-console" \
  packages/nostr-research/src packages/nostr-research/bin packages/nostr-research/package.json \
  packages/nostr-research/README.md CONTEXT.md
