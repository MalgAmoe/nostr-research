#!/bin/sh
set -eu

npm run check
npm test

artifact="workflow/artifacts/simplified-system-field-trial.md"
test -s "$artifact"
rg -n "goal-directed|open-ended|evidence|provenance|local|external|bound|partial|JavaScript|verdict" \
  "$artifact" >/dev/null
