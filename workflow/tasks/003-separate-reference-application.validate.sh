#!/bin/sh
set -eu

test -s package.json
test -s apps/reference-client/package.json
test -d apps/reference-client/src
test -s apps/reference-client/server.mjs
test -s apps/reference-client/vite.config.js
test -d packages/nostr-research

npm test --workspace apps/reference-client
npm run build --workspace apps/reference-client
node --check apps/reference-client/server.mjs
node --check apps/reference-client/scripts/generate-keys.mjs
