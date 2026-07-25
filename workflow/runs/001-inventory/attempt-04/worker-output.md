Deliverables changed:
- workflow/artifacts/capability-inventory.md
  - Corrected persistence limits: saved recipes, baseline/run records, and collections are uncapped; browser session, pulse snapshots, and checkpoints cap IDs at 1,000; session pins cap at 150.

Validation performed:
- workflow/tasks/001-inventory.validate.sh passed.
- git diff --check passed.
- Confirmed no protected product source files changed.

Unresolved uncertainties:
- None introduced.