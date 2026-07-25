Deliverables changed:

- Added an inspectable provisional-exclusions panel with Focus and Re-include actions.
- Projected excluded subjects through the public memory API.
- Added integration coverage for exclude/re-include.
- Replaced static shell inspection with a real Safari WebDriver smoke scenario covering the full controlled research loop.

Validation performed:

- Task validation script passed.
- `npm test` passed; localhost-dependent tests were skipped due sandbox EPERM.
- `npm run check`, test syntax checks, and `git diff --check` passed.

Unresolved uncertainty:

- Actual browser/runtime and responsive verification still requires an environment permitting localhost listeners and Safari automation.