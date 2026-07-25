CHANGES_REQUIRED

1. `apps/research-playground/server.test.js` does not provide the required browser-level smoke scenario. It only fetches HTML/JavaScript and searches for control IDs and strings; it never drives an actual browser through acquisition, selection, focus, traversal, back, and checkpoint. Add the specified browser-driven smoke scenario using a controlled acquisition source.

2. `apps/research-playground/app.js` does not provide a meaningful provisional include workflow. “Include” is available only on subjects already in the current selection, while excluded subjects immediately disappear and cannot be re-included except by undoing state with Back. Provide a UI path to inspect provisional exclusions and re-include an excluded subject through `session.include`.

3. Mandatory independent runtime and responsive verification could not be completed because this reviewer environment rejects the documented listener with `listen EPERM 127.0.0.1:4317`. After the above changes, validation must be performed in an environment permitting localhost listeners and actual browser access.