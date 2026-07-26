#!/bin/sh
set -eu

npm run check
npm test

test -s workflow/artifacts/composable-session-field-trial.md

rg -n "JavaScript|judgment|navigation|lifecycle|missing|verdict" \
  workflow/artifacts/composable-session-field-trial.md >/dev/null
