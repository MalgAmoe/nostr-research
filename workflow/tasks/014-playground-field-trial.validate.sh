#!/bin/sh
set -eu

test -s workflow/artifacts/first-playground-field-trial.md

grep -q 'relay' workflow/artifacts/first-playground-field-trial.md
grep -q 'checkpoint' workflow/artifacts/first-playground-field-trial.md

