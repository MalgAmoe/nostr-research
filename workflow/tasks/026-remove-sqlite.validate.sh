#!/bin/sh
set -eu

npm run check
npm test

if rg -n -i \
  "node:sqlite|DatabaseSync|CREATE TABLE|CREATE INDEX|BEGIN TRANSACTION|\\.sqlite|sqlite-backed|SQLite memory|databasePath|--db" \
  packages/nostr-research/src \
  packages/nostr-research/bin \
  packages/nostr-research/README.md \
  packages/nostr-research/package.json \
  CONTEXT.md; then
  echo "SQLite or database-path behavior remains in the active project surface." >&2
  exit 1
fi

if rg -n "createResearchWorkspace|class ResearchWorkspace|research\\.workspace" \
  packages/nostr-research/src \
  packages/nostr-research/bin \
  packages/nostr-research/README.md; then
  echo "The superseded separate workspace remains in the active project surface." >&2
  exit 1
fi

