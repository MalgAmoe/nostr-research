#!/bin/sh
set -eu

npm run check
npm test

test -s workflow/artifacts/declarative-research-plan-field-trial.md

rg -n "complete plan|Plan data|JavaScript|judgment|budget|eviction" \
  workflow/artifacts/declarative-research-plan-field-trial.md >/dev/null
