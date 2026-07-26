#!/bin/sh
set -eu

npm run check
npm test

if rg -n "node:fs|importFixtures|loadFixtureEvents" \
  packages/nostr-research/src \
  packages/nostr-research/bin \
  packages/nostr-research/README.md; then
  echo "Test-fixture loading remains in the production interface." >&2
  exit 1
fi

if rg -n "inspect\\(reference, options|memory\\.inspect\\(reference, options" \
  packages/nostr-research/src; then
  echo "The ignored inspection options remain." >&2
  exit 1
fi

