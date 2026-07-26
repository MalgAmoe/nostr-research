#!/bin/sh
set -eu

npm run check
npm test

test -s workflow/artifacts/declarative-session-field-trials.md

rg -n "JavaScript|JSONL|revision|partial|empty|warning|trial" \
  workflow/artifacts/declarative-session-field-trials.md >/dev/null

test -x packages/nostr-research/bin/nostr-research-session.js
