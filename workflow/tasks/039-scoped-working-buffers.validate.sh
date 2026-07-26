#!/bin/sh
set -eu

npm run check
npm test

node packages/nostr-research/bin/nostr-research-session.js --help >/dev/null
