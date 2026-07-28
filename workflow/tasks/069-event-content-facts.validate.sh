#!/bin/sh
set -eu

npm run check
npm test
node workflow/browser-smoke/run.mjs
