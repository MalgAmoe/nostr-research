Implemented both review findings.

Deliverables changed:

- Scoped selection now resolves prefixes, filters, orders, and applies limits within acquisition subjects only.
- Concise acquisition output now includes duplicate-observation counts and bounded relay outcome/completeness summaries.
- Adapted the existing public acquisition scenario to protect scoped-limit behavior with unrelated corpus evidence.
- Added envelope assertions for duplicate and relay summaries.

Validation:

- `git diff --check` passed.
- Task validation passed: 21 tests passed, 15 loopback tests skipped because the sandbox forbids listeners.
- Existing external manual public-command evidence remains available for the complete acquisition workflow.

Permanent tests expanded:

- Existing functional acquisition scenarios now protect scoped-versus-corpus limit semantics and the bounded response envelope. Temporary validation alone was insufficient for these stable local regression risks.
- No new acquisition test or production injection seam added.

Unresolved uncertainties:

- Loopback assertions could not execute in this sandbox; the previously recorded outer-environment evidence covers the public network command chain.