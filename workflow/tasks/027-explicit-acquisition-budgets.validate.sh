#!/bin/sh
set -eu

npm run check
npm test

if rg -n "eventLimit" \
  packages/nostr-research/src \
  packages/nostr-research/bin \
  packages/nostr-research/README.md \
  CONTEXT.md; then
  echo "The misleading active eventLimit vocabulary remains." >&2
  exit 1
fi

