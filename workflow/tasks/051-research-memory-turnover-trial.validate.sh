#!/bin/sh
set -eu

npm run check
npm test

test -s workflow/artifacts/research-memory-turnover-field-trial.md
rg -n "buffer|archive|notebook|turnover|unresolved|size|verdict" \
  workflow/artifacts/research-memory-turnover-field-trial.md >/dev/null
