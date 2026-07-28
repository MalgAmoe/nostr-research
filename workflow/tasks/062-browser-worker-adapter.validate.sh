#!/bin/sh
set -eu

npm run check
npm test
node workflow/tasks/062-browser-worker-adapter.proof.mjs

if rg -n "from ['\"]node:|from ['\"]ws['\"]|jsonl-session" \
  packages/nostr-research/src/browser-worker.js
then
  echo "Browser Worker entry imports a Node-only adapter or dependency." >&2
  exit 1
fi

test -f workflow/artifacts/browser-worker-adapter-proof.md
