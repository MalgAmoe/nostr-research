#!/bin/sh
set -eu

npm test
npm run check

node -e "import('@nostr-research/memory').then((module) => { if (typeof module.createResearchSession !== 'function') process.exit(1); })"

