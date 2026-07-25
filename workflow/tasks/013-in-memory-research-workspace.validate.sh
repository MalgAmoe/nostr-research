#!/bin/sh
set -eu

npm test
npm run check
npm run --silent research -- --help >/dev/null
