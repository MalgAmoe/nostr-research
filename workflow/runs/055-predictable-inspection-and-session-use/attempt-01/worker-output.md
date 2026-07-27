Deliverables changed:
- Added five bounded observation modes: preview, summary, coverage, details, and explain.
- Added contextual next-operation constraints/examples, including collection/relation/subject transitions.
- Moved `forget` semantics into the authoritative operation executor.
- Prevented local coverage from being confused with relay coverage.
- Added a sequential JSONL research walkthrough.
- Removed eager collection metadata from ordinary previews.

Validation:
- Task validation script passed.
- All 16 functional tests passed.
- JSONL executable replay confirmed bounded output and stable read-only revisions.
- `git diff --check` passed.

Permanent tests expanded:
- Public declarative observation workflow now protects all five observation meanings, contextual discovery, and unchanged revisions.
- Evidence-lifetime workflow now verifies explicit coverage projection. Permanent coverage is justified because these are stable session-envelope behaviors.

Unresolved uncertainties: none.