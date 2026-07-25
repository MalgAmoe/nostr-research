Completed project contract task.

Deliverables:
- CONTEXT.md: canonical project direction, terminology, testing policy, and open decisions.
- docs/decisions/001-library-and-memory.md: single decision record for the UI-independent SQLite-backed library.
- workflow/tasks/002-project-contract.validate.sh: corrected open-decision grep pattern to `unresolved\|undecided\|open decision`.

Validation:
- Ran `sh workflow/tasks/002-project-contract.validate.sh` successfully.
- Checked protected product paths; no changes reported.

Unresolved uncertainties:
- Intentional product decisions remain documented in CONTEXT.md (relay reliability, trust boundaries, provenance detail, policy, and future interfaces).