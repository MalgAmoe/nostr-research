#!/bin/sh
set -eu

npm test
npm run check
npm run --silent research-console -- --help >/dev/null
test -s workflow/artifacts/first-console-field-trial.md
