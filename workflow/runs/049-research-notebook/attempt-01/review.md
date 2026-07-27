CHANGES_REQUIRED

1. The required complete observation-buffer turnover is not verified. `declarative-observation.functional.test.js` creates capacity 3 and ingests only two events, so no eviction occurs. Extend the public workflow to force complete turnover and confirm notebook judgments and membership remain usable while evidence becomes unresolved.

2. Explicit summary/derived-observation entries are not fully supported. `normalizeNotebookEntry()` rejects entries containing only `kind`, `summary`, `reason`, `attribution`, and source references because it still requires a label, note, or judgment. Allow bounded summary/derived-observation entries as required.

3. Declarative plan mutations are misclassified. `#preparePlan()` still checks `operation === 'retain'`, so plans containing `remember` or `remember-membership` do not advance the session revision. Update mutation detection to the notebook operations.

4. Superseded retained-set terminology and behavior remain in public documentation and source messages. For example, the package README still says plans support `retain` and repeatedly describes retained selections, while `interpreter.js` retains obsolete `retain` warnings/errors. Remove or update these superseded shapes as the task explicitly requires.