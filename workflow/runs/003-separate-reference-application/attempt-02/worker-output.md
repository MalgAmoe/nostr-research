Deliverables verified:
- Reference client relocated to apps/reference-client/.
- Root npm workspace and direct root commands configured.
- packages/nostr-research/ reserved with only a purpose README.
- Documentation and ignore rules updated for the new layout.
- All original client source and permanent tests confirmed byte-for-byte intact after relocation.

Validation performed:
- workflow/tasks/003-separate-reference-application.validate.sh passed.
- 44 client tests passed.
- Production build passed.
- Server and key-generation syntax checks passed.
- Root npm test command passed.
- Ignore coverage confirmed for dependencies, builds, keys, logs, and SQLite files.

Unresolved uncertainties:
- None.