Implemented both review fixes in `interpreter.js`:

- Concise `added` and `refreshed` counts now represent distinct, mutually exclusive subjects.
- Relay attempted/completeness/outcome counts now include only relays with `contacted: true`.
- Detailed coverage remains unchanged and available on demand.

Validation performed:

- `git diff --check` passed.
- Task validation passed.
- Tests: 21 passed, 0 failed, 15 loopback tests skipped due to sandbox restrictions.

Permanent tests added or expanded: none, per task policy.

Unresolved uncertainties: none.