CHANGES_REQUIRED

1. `workflow/tasks/002-project-contract.validate.sh` exits 1 because its open-decision grep pattern is double-escaped and cannot match `CONTEXT.md`. Correct the pattern to `unresolved\|undecided\|open decision` and rerun validation. The intended pattern matches the document; the current script requires literal backslashes.