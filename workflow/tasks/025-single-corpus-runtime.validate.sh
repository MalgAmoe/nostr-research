#!/bin/sh
set -eu

npm run check
npm test

if rg -n "An open research workspace is required|--db <sqlite-path>" \
  packages/nostr-research/src packages/nostr-research/bin; then
  echo "Active runtime still requires the old workspace/database split." >&2
  exit 1
fi

