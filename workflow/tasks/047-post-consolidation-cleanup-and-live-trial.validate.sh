#!/bin/sh
set -eu

npm run check
npm test

test -s workflow/artifacts/consolidated-navigation-field-trial.md
rg -n "authored|referenced|followed|hydrate|JavaScript|manual|verdict" \
  workflow/artifacts/consolidated-navigation-field-trial.md >/dev/null
