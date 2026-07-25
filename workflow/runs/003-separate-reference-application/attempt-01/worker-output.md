Deliverables changed:
- Moved the Solid reference client into `apps/reference-client/`, including source, tests, server, Vite config, HTML, key generator, package metadata, README, keys, and logs.
- Added root npm workspace scripts for start/dev/build/test/check/key generation.
- Added reserved `packages/nostr-research/README.md`.
- Updated root README and `.gitignore` (including SQLite artifacts).

Validation performed:
- `sh workflow/tasks/003-separate-reference-application.validate.sh` passed.
- Root workspace `npm install --ignore-scripts`, `npm test`, and `npm run check` passed (44 tests; production build and syntax checks pass).

Unresolved uncertainty:
- A root `npm start` smoke test reached the relocated server command but could not bind localhost due to sandbox `EPERM`; this environment blocks listener creation.