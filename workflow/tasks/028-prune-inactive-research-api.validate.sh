#!/bin/sh
set -eu

npm run check
npm test

if rg -n \
  "recordRun|getRun|listRuns|createSetFromRun|expandSet|combineSets|addSetMember|removeSetMember|explainSetMember|getAcquisitionCoverage|listAcquisitionCoverage|acquisitionCoverage|relatedEvent|relatedAccount|searchEvents" \
  packages/nostr-research/src \
  packages/nostr-research/bin \
  packages/nostr-research/README.md \
  CONTEXT.md; then
  echo "An API selected for removal remains in the active project surface." >&2
  exit 1
fi

