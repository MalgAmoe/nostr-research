#!/bin/sh
set -eu

test -d apps
test "$(find apps -mindepth 2 -maxdepth 2 -name package.json | wc -l | tr -d ' ')" -ge 1

npm test
npm run check

