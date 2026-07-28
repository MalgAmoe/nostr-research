#!/bin/sh
set -eu

npm run check
npm test
node workflow/tasks/061-browser-compatible-session-proof.mjs
