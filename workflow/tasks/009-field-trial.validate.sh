#!/bin/sh
set -eu

report=workflow/artifacts/first-library-field-trial.md
test -s "$report"

grep -qi 'relay' "$report"
grep -qi 'provenance' "$report"
grep -qi 'research path' "$report"
grep -qi 'next task' "$report"
grep -Eqi 'not (to )?build|do not build|remain unimplemented' "$report"

git diff --quiet -- apps packages CONTEXT.md docs package.json package-lock.json README.md \
  workflow/ROADMAP.md workflow/WORKFLOW.md workflow/run.py workflow/prompts
