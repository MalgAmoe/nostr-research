#!/bin/sh
set -eu

npm run check
npm test

if rg -n 'candidateIds\(|function normalizeProjectionLimit|function isPublicResearchSet' \
  packages/nostr-research/src
then
  echo "Verified dead definitions remain in the source." >&2
  exit 1
fi
