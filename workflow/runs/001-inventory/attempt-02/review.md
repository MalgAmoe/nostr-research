CHANGES_REQUIRED

1. `workflow/artifacts/capability-inventory.md:202` incorrectly says complete research packages support “export/import.” The application only exports them (`exportResearchPackage`); it has no package-import path. Correct this capability and any related wording.

2. `workflow/artifacts/capability-inventory.md:50` names a nonexistent API, `loadRelayInformation(Set)`. The source exports `loadRelayInformation(relay)` and `loadRelayInformationSet(relays)` in `src/relay-info.js`. Use the actual symbols.

3. `workflow/artifacts/open-questions.md` misclassifies several intent/product questions as repository-answerable factual questions (notably items 1–3 and 5–6). The repository already establishes the implemented behavior or lacks the requested intent; move these to product decisions or replace them with factual questions resolvable from current source/tests.