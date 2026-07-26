Implemented the continuation presentation correction.

- Changed `show` to project any report containing an existing result collection, preserving specialized acquisition presentation.
- Expanded the existing public continuation workflow test to replay `show(authored)` and verify bounded output with omission metadata.
- Validation: focused continuation test, full task validation, syntax checks, full test suite, and `git diff --check` all passed.
- Permanent tests expanded: one assertion protects bounded public continuation presentation and prevents `INTERNAL_ERROR`; temporary validation alone would not prevent regression.
- Unresolved uncertainties: none.
- Runner-owned workflow task/run files were left untouched.