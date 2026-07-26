#!/bin/sh
set -eu

npm run check
npm test

if rg -n "eval\\(|new Function" packages/nostr-research/src; then
  echo "Plan validation must not introduce executable plan data." >&2
  exit 1
fi
