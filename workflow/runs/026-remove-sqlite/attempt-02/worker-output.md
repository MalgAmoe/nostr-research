Deliverables changed:
- Restored disposable TLS certificate directories for acquisition test contexts.
- Ensured cleanup removes those temporary directories.
- Corrected acquisition test import formatting.
- Existing task changes remove SQLite/workspace persistence and update runtime documentation.

Validation:
- `workflow/tasks/026-remove-sqlite.validate.sh` passes.
- Syntax checks pass.
- Functional suite: 16 passed, 9 loopback-dependent tests skipped by sandbox, 0 failed.
- SQLite/workspace searches pass.
- Declared dependencies contain only `nostr-tools` and `ws`; no SQLite replacement.
- `git diff --check` passes.

Unresolved uncertainties:
- This sandbox forbids loopback listeners, so the nine repaired relay tests could not execute here. They now receive valid certificate paths for reviewer execution.
- Local `node_modules` contains unrelated extraneous packages and a pre-existing installed `ws` version mismatch; package metadata and lockfile are clean of SQLite.