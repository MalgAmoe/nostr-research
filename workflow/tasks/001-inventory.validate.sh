#!/bin/sh
set -eu

test -s workflow/artifacts/capability-inventory.md
test -s workflow/artifacts/current-dependency-map.md
test -s workflow/artifacts/open-questions.md

grep -q 'src/' workflow/artifacts/capability-inventory.md
grep -q 'src/' workflow/artifacts/current-dependency-map.md
