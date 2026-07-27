#!/bin/sh
set -eu

npm run check
npm test

artifact="workflow/artifacts/operation-and-state-inventory.md"
test -s "$artifact"
rg -n "operation|input|output|local|external|collection|relation|acquisition|session|keep|merge|remove" \
  "$artifact" >/dev/null
