#!/bin/sh
set -eu

npm run check
npm test

if rg -n "Embedded record must exactly match the canonical record" \
  packages/nostr-research/src; then
  echo "Byte-for-byte embedded canonical-record identity remains." >&2
  exit 1
fi
