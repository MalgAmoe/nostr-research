Deliverables changed:
- workflow/artifacts/capability-inventory.md
  - Added private Seed Accounts capability record with parsing, persistence, search, direction limits, locations, coverage, assessment, and contradictions.
  - Documented dotted local-archive query/index mismatch under capability 2.4.

Validation performed:
- sh workflow/tasks/001-inventory.validate.sh
- git diff --check
- Confirmed no protected product-source diff.

Unresolved uncertainties:
- None beyond the behavior uncertainties now recorded in the inventory.