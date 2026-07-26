Implemented task 039 and addressed both review findings.

Deliverables changed:

- Fixed scoped selection to preserve explicit event typing for empty results, allowing acquisition → select → move → empty hydration plans to succeed.
- Moved scoped-buffer, bounded projection, explicit corpus scope, and handle replacement assertions into a deterministic fixture-backed public workflow.
- Removed those assertions from the loopback relay test.
- Preserved canonical evidence when advancing/replacing working handles.

Validation:

- Full `039-scoped-working-buffers.validate.sh` passed.
- 22 tests passed; 15 relay-network tests skipped because the sandbox forbids loopback listeners.
- Syntax checks and `git diff --check` passed.
- Independently reproduced and verified the formerly failing normalized plan path.

Permanent tests:

- Added one fixture-backed public-boundary scenario protecting acquisition-slice identity versus corpus contents, concise default output, bounded opt-in coverage, explicit corpus selection, and non-destructive handle replacement.
- Permanent coverage is justified because these are stable session and result-envelope contracts; relay mechanics remain excluded.

Unresolved uncertainties:

- Live/loopback acquisition could not run in this sandbox. No source-level uncertainty remains around the reviewed failure.