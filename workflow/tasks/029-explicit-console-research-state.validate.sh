#!/bin/sh
set -eu

npm run check
npm test

if rg -n "traverse\\(\\.\\.\\.args\\)|retain\\(valueOrName" packages/nostr-research/src; then
  echo "State-changing argument-count overloads remain." >&2
  exit 1
fi

