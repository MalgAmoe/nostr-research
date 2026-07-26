#!/bin/sh
set -eu

npm run check
npm test

if rg -n "eval\\(|new Function" packages/nostr-research/src; then
  echo "The collection algebra must not execute supplied code." >&2
  exit 1
fi
