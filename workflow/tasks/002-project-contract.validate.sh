#!/bin/sh
set -eu

test -s CONTEXT.md
test -s docs/decisions/001-library-and-memory.md

grep -qi 'SQLite' CONTEXT.md
grep -qi 'functional test' CONTEXT.md
grep -qi 'provenance' CONTEXT.md
grep -qi 'raw.*event' CONTEXT.md
grep -qi 'unresolved\|undecided\|open decision' CONTEXT.md
grep -qi 'SQLite' docs/decisions/001-library-and-memory.md
