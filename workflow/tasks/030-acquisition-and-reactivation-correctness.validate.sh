#!/bin/sh
set -eu

npm run check
npm test

if ! rg -n "matchFilter" packages/nostr-research/src/acquire.js >/dev/null; then
  echo "Direct acquisition does not visibly enforce the requested Nostr filter." >&2
  exit 1
fi

if rg -n "eventLimit" \
  packages/nostr-research/src \
  packages/nostr-research/bin \
  packages/nostr-research/README.md \
  CONTEXT.md; then
  echo "The obsolete acquisition limit remains in the active surface." >&2
  exit 1
fi

