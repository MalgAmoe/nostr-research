CHANGES_REQUIRED

1. The required validation fails in `acquisition.functional.test.js:160`: the acquisition → scoped select → move → empty hydration plan returns `ok: false`. Fix the normalized plan/session path so this existing public workflow succeeds, then rerun the complete validation script successfully.

2. The permanent scoped-buffer coverage was added to a loopback relay-network test (`declarative session preserves handles...`). The task explicitly excludes relay-network tests and permits one public session-boundary functional scenario. Move the stable scope, concise-envelope, coverage-projection, and replacement assertions into a deterministic non-network public-boundary scenario; keep live/loopback acquisition only as temporary validation evidence.