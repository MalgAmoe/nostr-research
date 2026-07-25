Deliverables changed:
- workflow/artifacts/capability-inventory.md
- workflow/artifacts/open-questions.md

Corrections:
- Used actual relay-info exports: loadRelayInformation(relay) and loadRelayInformationSet(relays).
- Corrected complete research packages as export-only; no package import path exists.
- Reclassified intent questions as product decisions; factual section now records repository-established facts.

Validation:
- sh workflow/tasks/001-inventory.validate.sh
- npm test — 44 passing
- Protected product paths unchanged; git diff --check passed.

Unresolved uncertainties:
- No factual repository questions remain. Later-library choices are explicitly recorded as product decisions.